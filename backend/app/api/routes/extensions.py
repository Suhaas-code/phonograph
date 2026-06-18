"""Extension framework routes.

Extensions are registered per-user via a manifest URL and run as independent
external services; Phonograph only ever calls them over HTTP (see EXTENSIONS.md).
All routes are owner-scoped: an extension is visible only to the user who
installed it (404 otherwise, matching the rest of the API).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_approved_user
from app.config import settings
from app.database import get_db
from app.models.extension import Extension
from app.models.user import User
from app.schemas.extension import (
    ExtensionDetail,
    ExtensionEventOut,
    ExtensionInstall,
    ExtensionOut,
    ManifestPreview,
    ManifestPreviewRequest,
    RefreshSummary,
    SearchSummary,
)
from app.services import extensions as svc
from app.services.url_guard import ExtensionHTTPError, RateLimitError

router = APIRouter(prefix="/extensions", tags=["extensions"])

MAX_EVENTS = 20


def _require_enabled_feature() -> None:
    if not settings.extensions_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Extensions are disabled"
        )


def _get_owned_extension(db: Session, user: User, ext_id: int) -> Extension:
    ext = db.get(Extension, ext_id)
    if ext is None or ext.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Extension not found"
        )
    return ext


def _detail(db: Session, ext: Extension) -> ExtensionDetail:
    base = ExtensionOut.model_validate(ext)
    events = [ExtensionEventOut.model_validate(e) for e in ext.events[:MAX_EVENTS]]
    return ExtensionDetail(**base.model_dump(), events=events)


def _map_service_errors(exc: Exception) -> HTTPException:
    if isinstance(exc, svc.ManifestValidationError):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    if isinstance(exc, svc.ExtensionStateError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, RateLimitError):
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="The external service is rate-limiting requests. Try again shortly.",
        )
    if isinstance(exc, ExtensionHTTPError):
        return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
    raise exc


@router.post("/preview", response_model=ManifestPreview)
def preview_manifest(
    payload: ManifestPreviewRequest,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> ManifestPreview:
    _require_enabled_feature()
    try:
        manifest = svc.fetch_and_validate_manifest(payload.manifest_url)
    except (svc.ManifestValidationError, ExtensionHTTPError) as exc:
        raise _map_service_errors(exc)
    return svc.build_preview(manifest)


@router.post("", response_model=ExtensionDetail, status_code=status.HTTP_201_CREATED)
def install_extension(
    payload: ExtensionInstall,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> ExtensionDetail:
    _require_enabled_feature()
    try:
        ext = svc.install(db, user, payload)
    except (svc.ManifestValidationError, svc.ExtensionStateError, ExtensionHTTPError) as exc:
        raise _map_service_errors(exc)
    return _detail(db, ext)


@router.get("", response_model=list[ExtensionOut])
def list_extensions(
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> list[Extension]:
    return list(
        db.scalars(
            select(Extension)
            .where(Extension.owner_id == user.id)
            .order_by(Extension.created_at.desc())
        )
    )


@router.get("/{ext_id}", response_model=ExtensionDetail)
def get_extension(
    ext_id: int,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> ExtensionDetail:
    ext = db.scalar(
        select(Extension)
        .where(Extension.id == ext_id, Extension.owner_id == user.id)
        .options(selectinload(Extension.events))
    )
    if ext is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Extension not found")
    return _detail(db, ext)


@router.post("/{ext_id}/enable", response_model=ExtensionOut)
def enable_extension(
    ext_id: int,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> Extension:
    ext = _get_owned_extension(db, user, ext_id)
    return svc.set_enabled(db, ext, True)


@router.post("/{ext_id}/disable", response_model=ExtensionOut)
def disable_extension(
    ext_id: int,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> Extension:
    ext = _get_owned_extension(db, user, ext_id)
    return svc.set_enabled(db, ext, False)


@router.post("/{ext_id}/refresh", response_model=RefreshSummary)
def refresh_extension(
    ext_id: int,
    track_id: int,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> RefreshSummary:
    ext = _get_owned_extension(db, user, ext_id)
    try:
        return svc.refresh(db, ext, track_id)
    except (svc.ExtensionStateError, ExtensionHTTPError) as exc:
        raise _map_service_errors(exc)


@router.get("/{ext_id}/search", response_model=SearchSummary)
def search_extension(
    ext_id: int,
    q: str,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> SearchSummary:
    ext = _get_owned_extension(db, user, ext_id)
    try:
        return svc.search(db, ext, q)
    except (svc.ExtensionStateError, ExtensionHTTPError) as exc:
        raise _map_service_errors(exc)


@router.post("/{ext_id}/update", response_model=ExtensionDetail)
def update_extension(
    ext_id: int,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> ExtensionDetail:
    ext = _get_owned_extension(db, user, ext_id)
    try:
        ext = svc.update_manifest(db, ext)
    except (svc.ManifestValidationError, ExtensionHTTPError) as exc:
        raise _map_service_errors(exc)
    return _detail(db, ext)


@router.post("/{ext_id}/reapprove", response_model=ExtensionDetail)
def reapprove_extension(
    ext_id: int,
    payload: ExtensionInstall,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> ExtensionDetail:
    ext = _get_owned_extension(db, user, ext_id)
    try:
        ext = svc.reapprove(db, ext, payload.approved_permissions)
    except svc.ManifestValidationError as exc:
        raise _map_service_errors(exc)
    return _detail(db, ext)


@router.delete("/{ext_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_extension(
    ext_id: int,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> None:
    ext = _get_owned_extension(db, user, ext_id)
    svc.remove(db, ext)
