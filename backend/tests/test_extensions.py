"""Unit tests for manifest validation, the request allowlist, and signing.

These exercise pure logic (no database / network)."""
import pytest
from pydantic import ValidationError

from app.models.extension import Extension
from app.models.track import Track
from app.models.variant import Variant
from app.schemas.extension import ManifestModel, RefreshResultItem
from app.services.extensions import _build_request_tracks, _sign


# --------------------------------------------------------------------------- #
# Manifest validation
# --------------------------------------------------------------------------- #
def _valid_manifest() -> dict:
    return {
        "api_version": "1.0",
        "name": "Enricher",
        "version": "1.0.0",
        "author": "Tester",
        "endpoint_url": "https://ext.example.com",
        "capabilities": ["metadata.refresh"],
        "required_permissions": ["read:tracks"],
    }


def test_valid_manifest_parses() -> None:
    m = ManifestModel.model_validate(_valid_manifest())
    assert m.name == "Enricher"


def test_unknown_field_rejected() -> None:
    bad = _valid_manifest() | {"evil": "payload"}
    with pytest.raises(ValidationError):
        ManifestModel.model_validate(bad)


def test_unsupported_api_version_rejected() -> None:
    bad = _valid_manifest() | {"api_version": "9.9"}
    with pytest.raises(ValidationError):
        ManifestModel.model_validate(bad)


def test_unknown_capability_rejected() -> None:
    bad = _valid_manifest() | {"capabilities": ["metadata.refresh", "run.code"]}
    with pytest.raises(ValidationError):
        ManifestModel.model_validate(bad)


def test_unknown_permission_rejected() -> None:
    bad = _valid_manifest() | {"required_permissions": ["read:tracks", "delete:everything"]}
    with pytest.raises(ValidationError):
        ManifestModel.model_validate(bad)


# --------------------------------------------------------------------------- #
# Refresh response parsing rejects smuggled fields (e.g. audio)
# --------------------------------------------------------------------------- #
def test_refresh_item_rejects_extra_fields() -> None:
    with pytest.raises(ValidationError):
        RefreshResultItem.model_validate(
            {"ref": 1, "audio": "ZmFrZSBhdWRpbw==", "genre": "Rock"}
        )


def test_refresh_item_minimal_ok() -> None:
    item = RefreshResultItem.model_validate({"ref": 1})
    assert item.ref == 1 and item.streaming_links == []


# --------------------------------------------------------------------------- #
# Request allowlist + read:tracks gating
# --------------------------------------------------------------------------- #
def _track() -> Track:
    t = Track(id=1, owner_id=1, artist="Radiohead", title="Idioteque",
              normalized_artist="radiohead", normalized_title="idioteque")
    t.variants = [Variant(album="Kid A", year=2000)]
    return t


def test_request_omits_track_data_without_read_permission() -> None:
    ext = Extension(id=1, granted_permissions=["write:streaming_links"])
    assert _build_request_tracks(ext, [_track()]) == []


def test_request_only_emits_allowlisted_fields() -> None:
    ext = Extension(id=1, granted_permissions=["read:tracks"])
    out = _build_request_tracks(ext, [_track()])
    assert len(out) == 1
    assert set(out[0]) == {"ref", "artist", "title", "album", "year", "isrc"}
    assert out[0]["album"] == "Kid A" and out[0]["year"] == 2000


# --------------------------------------------------------------------------- #
# Signing is deterministic over "{timestamp}.{body}"
# --------------------------------------------------------------------------- #
def test_signature_is_stable_and_secret_dependent() -> None:
    a = _sign("secret", "1700000000", '{"a":1}')
    b = _sign("secret", "1700000000", '{"a":1}')
    c = _sign("other", "1700000000", '{"a":1}')
    assert a == b and a != c and len(a) == 64
