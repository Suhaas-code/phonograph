"""Extension framework orchestration.

Phonograph is purely an HTTP *client* of an extension: it fetches and validates
the manifest, has the user approve the requested permissions, and calls the
extension's endpoint on demand. Nothing the extension returns is executed — it is
parsed into strict Pydantic models and applied only within the granted
permissions. Audio is never sent or accepted.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import secrets
import time
from datetime import datetime, timezone

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import settings

logger = logging.getLogger(__name__)
from app.models.extension import Extension, ExtensionEvent, ExtensionStatus
from app.models.streaming_link import StreamingLink, normalize_service
from app.models.track import Track
from app.models.user import User
from app.schemas.extension import (
    PERMISSION_DESCRIPTIONS,
    ExtensionInstall,
    ManifestModel,
    ManifestPreview,
    RefreshResultItem,
    RefreshSummary,
    SearchResultItem,
    SearchSummary,
)
from app.services.url_guard import (
    ExtensionHTTPError,
    OutboundURLError,
    safe_get_json,
    safe_post_json,
    validate_outbound_url,
)


class ManifestValidationError(ValueError):
    """The fetched manifest was structurally invalid (-> HTTP 422)."""


class ExtensionStateError(RuntimeError):
    """An action is not valid for the extension's current state (-> HTTP 409)."""


# --------------------------------------------------------------------------- #
# Events
# --------------------------------------------------------------------------- #
def _event(db: Session, ext: Extension, kind: str, detail: str | None = None) -> None:
    db.add(ExtensionEvent(extension_id=ext.id, kind=kind, detail=detail))


# --------------------------------------------------------------------------- #
# Manifest fetch & validation
# --------------------------------------------------------------------------- #
def fetch_and_validate_manifest(manifest_url: str) -> ManifestModel:
    """Fetch *manifest_url* and parse it into a validated ManifestModel.

    Both the manifest URL and the endpoint URL it declares are SSRF-checked.
    """
    try:
        validate_outbound_url(manifest_url)
    except OutboundURLError as exc:
        raise ManifestValidationError(str(exc)) from exc

    raw = safe_get_json(manifest_url)  # may raise ExtensionHTTPError

    try:
        manifest = ManifestModel.model_validate(raw)
    except ValidationError as exc:
        # Surface the first concise reason to the UI.
        first = exc.errors()[0]
        loc = ".".join(str(p) for p in first.get("loc", ())) or "manifest"
        raise ManifestValidationError(f"{loc}: {first.get('msg', 'invalid')}") from exc

    try:
        validate_outbound_url(manifest.endpoint_url)
    except OutboundURLError as exc:
        raise ManifestValidationError(f"endpoint_url: {exc}") from exc

    return manifest


def build_preview(manifest: ManifestModel) -> ManifestPreview:
    return ManifestPreview(
        name=manifest.name,
        version=manifest.version,
        author=manifest.author,
        api_version=manifest.api_version,
        endpoint_url=manifest.endpoint_url,
        capabilities=manifest.capabilities,
        required_permissions=manifest.required_permissions,
        permission_descriptions={
            p: PERMISSION_DESCRIPTIONS.get(p, p) for p in manifest.required_permissions
        },
    )


# --------------------------------------------------------------------------- #
# Request signing
# --------------------------------------------------------------------------- #
def _sign(secret: str, timestamp: str, body: str) -> str:
    msg = f"{timestamp}.{body}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()


def _signed_headers(ext: Extension, body: str) -> dict[str, str]:
    timestamp = str(int(time.time()))
    return {
        "X-Phonograph-Extension": str(ext.id),
        "X-Phonograph-Timestamp": timestamp,
        "X-Phonograph-Signature": _sign(ext.shared_secret, timestamp, body),
    }


def _endpoint(ext: Extension, path: str) -> str:
    return ext.endpoint_url.rstrip("/") + path


def _handshake(db: Session, ext: Extension, path: str, kind: str) -> None:
    """Best-effort lifecycle handshake (install / uninstall). Failure is recorded
    but never blocks the operation."""
    body = json.dumps(
        {
            "extension_id": ext.id,
            "shared_secret": ext.shared_secret,
            "granted_permissions": ext.granted_permissions,
        },
        separators=(",", ":"),
        sort_keys=True,
    )
    try:
        safe_post_json(_endpoint(ext, path), body=body, headers=_signed_headers(ext, body))
    except (ExtensionHTTPError, OutboundURLError) as exc:
        _event(db, ext, kind, f"handshake skipped: {exc}")


# --------------------------------------------------------------------------- #
# Install / lifecycle
# --------------------------------------------------------------------------- #
def install(db: Session, user: User, payload: ExtensionInstall) -> Extension:
    manifest = fetch_and_validate_manifest(payload.manifest_url)

    # The user must approve exactly the permissions the manifest requires — no
    # silent over- or under-grant.
    if sorted(payload.approved_permissions) != sorted(manifest.required_permissions):
        raise ManifestValidationError(
            "Approved permissions must match the manifest's required permissions"
        )

    existing = db.scalar(
        select(Extension).where(
            Extension.owner_id == user.id,
            Extension.manifest_url == payload.manifest_url,
        )
    )
    if existing is not None:
        raise ExtensionStateError("This extension is already installed")

    ext = Extension(
        owner_id=user.id,
        name=manifest.name,
        version=manifest.version,
        author=manifest.author,
        api_version=manifest.api_version,
        manifest_url=payload.manifest_url,
        endpoint_url=manifest.endpoint_url,
        capabilities=manifest.capabilities,
        requested_permissions=manifest.required_permissions,
        granted_permissions=manifest.required_permissions,
        status=ExtensionStatus.enabled,
        manifest_snapshot=manifest.model_dump(),
        shared_secret=secrets.token_urlsafe(48),
    )
    db.add(ext)
    db.flush()  # assign ext.id before the handshake / event
    _event(db, ext, "install", f"v{ext.version}")
    _handshake(db, ext, "/install", "install")
    db.commit()
    db.refresh(ext)
    return ext


def set_enabled(db: Session, ext: Extension, enabled: bool) -> Extension:
    ext.status = ExtensionStatus.enabled if enabled else ExtensionStatus.disabled
    if enabled:
        ext.last_error = None
    _event(db, ext, "enable" if enabled else "disable")
    db.commit()
    db.refresh(ext)
    return ext


def update_manifest(db: Session, ext: Extension) -> Extension:
    """Re-fetch the manifest and update in place. New permissions require
    re-approval before the extension can run again."""
    manifest = fetch_and_validate_manifest(ext.manifest_url)

    ext.name = manifest.name
    ext.version = manifest.version
    ext.author = manifest.author
    ext.api_version = manifest.api_version
    ext.endpoint_url = manifest.endpoint_url
    ext.capabilities = manifest.capabilities
    ext.requested_permissions = manifest.required_permissions
    ext.manifest_snapshot = manifest.model_dump()

    new_perms = sorted(set(manifest.required_permissions) - set(ext.granted_permissions))
    if new_perms:
        ext.needs_reapproval = True
        _event(db, ext, "update", f"v{ext.version}; needs re-approval: {', '.join(new_perms)}")
    else:
        # Drop any permissions the extension no longer requests.
        ext.granted_permissions = [
            p for p in ext.granted_permissions if p in manifest.required_permissions
        ]
        _event(db, ext, "update", f"v{ext.version}")
    db.commit()
    db.refresh(ext)
    return ext


def reapprove(db: Session, ext: Extension, approved_permissions: list[str]) -> Extension:
    if sorted(approved_permissions) != sorted(ext.requested_permissions):
        raise ManifestValidationError(
            "Approved permissions must match the extension's requested permissions"
        )
    ext.granted_permissions = list(ext.requested_permissions)
    ext.needs_reapproval = False
    _event(db, ext, "update", "permissions re-approved")
    db.commit()
    db.refresh(ext)
    return ext


def remove(db: Session, ext: Extension) -> None:
    _handshake(db, ext, "/uninstall", "remove")
    db.delete(ext)
    db.commit()


# --------------------------------------------------------------------------- #
# Refresh Metadata — the one capability that touches user data
# --------------------------------------------------------------------------- #
def _representative_variant(track: Track):
    """Pick a variant to source album/year from (first with a value)."""
    album = next((v.album for v in track.variants if v.album), None)
    year = next((v.year for v in track.variants if v.year), None)
    return album, year


def _build_request_tracks(ext: Extension, tracks: list[Track]) -> list[dict]:
    """Only emit track data when read:tracks is granted. The field set is a fixed
    allowlist — no file path, no bytes, nothing audio-related ever leaves here."""
    if "read:tracks" not in ext.granted_permissions:
        return []
    out: list[dict] = []
    for t in tracks:
        album, year = _representative_variant(t)
        out.append(
            {
                "ref": t.id,
                "artist": t.artist,
                "title": t.title,
                "album": album,
                "year": year,
                "isrc": None,
            }
        )
    return out


def _apply_streaming_links(db: Session, track: Track, item: RefreshResultItem) -> int:
    """Upsert streaming links (one per provider). Any provider is accepted —
    well-known or custom — so all surfaced links are stored."""
    written = 0
    by_service = {link.service: link for link in track.streaming_links}
    for enriched in item.streaming_links:
        service = normalize_service(enriched.service)
        if not service:
            continue
        existing = by_service.get(service)
        if existing is not None:
            if existing.url != enriched.url:
                existing.url = enriched.url
                written += 1
        else:
            link = StreamingLink(track_id=track.id, service=service, url=enriched.url)
            db.add(link)
            by_service[service] = link
            written += 1
    return written


def _apply_track_metadata(track: Track, item: RefreshResultItem) -> bool:
    """Non-destructively fill missing genre/year across the track's variants."""
    touched = False
    for v in track.variants:
        if item.genre and not v.genre:
            v.genre = item.genre[:160]
            touched = True
        if item.year and not v.year:
            v.year = item.year
            touched = True
    return touched


def refresh(db: Session, ext: Extension, track_id: int) -> RefreshSummary:
    if ext.status != ExtensionStatus.enabled:
        raise ExtensionStateError("Enable the extension before refreshing")
    if ext.needs_reapproval:
        raise ExtensionStateError("Re-approve the extension's permissions before refreshing")
    if "metadata.refresh" not in ext.capabilities:
        raise ExtensionStateError("This extension does not support metadata refresh")

    if ext.last_refresh_at is not None:
        elapsed = (datetime.now(timezone.utc) - ext.last_refresh_at).total_seconds()
        if elapsed < settings.extension_refresh_cooldown_seconds:
            raise ExtensionStateError("Refreshed too recently; try again shortly")

    track = db.scalar(
        select(Track)
        .where(Track.id == track_id, Track.owner_id == ext.owner_id)
        .options(selectinload(Track.variants), selectinload(Track.streaming_links))
    )
    if track is None:
        raise ExtensionStateError("Track not found")
    tracks = [track]
    tracks_by_id = {track.id: track}

    body = json.dumps(
        {
            "api_version": ext.api_version,
            "extension_id": ext.id,
            "granted_permissions": ext.granted_permissions,
            "tracks": _build_request_tracks(ext, tracks),
        },
        separators=(",", ":"),
        sort_keys=True,
    )

    try:
        raw = safe_post_json(
            _endpoint(ext, "/refresh"), body=body, headers=_signed_headers(ext, body)
        )
    except (ExtensionHTTPError, OutboundURLError) as exc:
        ext.status = ExtensionStatus.error
        ext.last_error = str(exc)
        _event(db, ext, "error", str(exc))
        db.commit()
        raise

    # Parse each result item independently so one malformed entry cannot abort the
    # whole refresh. Unknown fields are rejected by the strict item model.
    can_write_links = "write:streaming_links" in ext.granted_permissions
    can_write_meta = "write:track_metadata" in ext.granted_permissions
    links_written = 0
    meta_updated = 0
    skipped = 0
    for entry in raw.get("results", []) or []:
        try:
            item = RefreshResultItem.model_validate(entry)
        except ValidationError as exc:
            logger.warning("extension %s: dropped a refresh result: %s", ext.id, exc)
            skipped += 1
            continue
        track = tracks_by_id.get(item.ref)
        if track is None:
            skipped += 1
            continue  # ref not ours / not in this batch
        if can_write_links:
            links_written += _apply_streaming_links(db, track, item)
        if can_write_meta and _apply_track_metadata(track, item):
            meta_updated += 1

    ext.status = ExtensionStatus.enabled
    ext.last_error = None
    ext.last_refresh_at = datetime.now(timezone.utc)
    message = f"Updated {links_written} link(s), {meta_updated} track(s)"
    if skipped:
        message += f"; skipped {skipped} result(s)"
    _event(db, ext, "refresh", message)
    db.commit()
    db.refresh(ext)

    return RefreshSummary(
        extension_id=ext.id,
        status=ext.status,
        tracks_sent=len(tracks) if "read:tracks" in ext.granted_permissions else 0,
        links_written=links_written,
        tracks_metadata_updated=meta_updated,
        message=message,
        last_refresh_at=ext.last_refresh_at,
    )


# --------------------------------------------------------------------------- #
# Search Augmentation
# --------------------------------------------------------------------------- #
def search(db: Session, ext: Extension, query: str) -> SearchSummary:
    if ext.status != ExtensionStatus.enabled:
        raise ExtensionStateError("Enable the extension before searching")
    if ext.needs_reapproval:
        raise ExtensionStateError("Re-approve the extension's permissions before searching")
    if "search.augment" not in ext.capabilities:
        raise ExtensionStateError("This extension does not support search augmentation")

    body_data: dict = {
        "api_version": ext.api_version,
        "extension_id": ext.id,
        "granted_permissions": ext.granted_permissions,
    }
    if "read:query" in ext.granted_permissions:
        body_data["query"] = query

    body = json.dumps(body_data, separators=(",", ":"), sort_keys=True)

    try:
        raw = safe_post_json(
            _endpoint(ext, "/search"), body=body, headers=_signed_headers(ext, body)
        )
    except (ExtensionHTTPError, OutboundURLError) as exc:
        ext.status = ExtensionStatus.error
        ext.last_error = str(exc)
        _event(db, ext, "error", str(exc))
        db.commit()
        raise

    raw_results = raw.get("results", []) or []
    results: list[SearchResultItem] = []
    for entry in raw_results:
        try:
            results.append(SearchResultItem.model_validate(entry))
        except ValidationError as exc:
            logger.warning("extension %s: dropped a search result: %s", ext.id, exc)
            continue
    if raw_results and not results:
        logger.warning(
            "extension %s: all %d search result(s) were dropped during parsing",
            ext.id,
            len(raw_results),
        )

    return SearchSummary(extension_id=ext.id, results=results)
