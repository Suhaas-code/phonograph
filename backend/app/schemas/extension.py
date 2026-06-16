"""Extension framework schemas.

``ManifestModel`` and the ``Refresh*`` response models are parsed with
``extra="forbid"`` — an extension cannot smuggle unexpected fields (e.g. anything
audio-related) past the boundary. The ``*Out`` models deliberately omit
``shared_secret``.
"""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.extension import (
    CAPABILITIES,
    PERMISSIONS,
    SUPPORTED_API_VERSIONS,
    ExtensionStatus,
)

# Plain-language descriptions surfaced in the install/approval UI.
PERMISSION_DESCRIPTIONS: dict[str, str] = {
    "read:tracks": "Send your track metadata (artist, title, album, year) to the extension.",
    "read:libraries": "Send your library names and structure to the extension.",
    "write:streaming_links": "Add or update streaming-service links on your tracks.",
    "write:track_metadata": "Fill in missing genre and year on your tracks.",
}


# --------------------------------------------------------------------------- #
# Manifest (fetched from the extension's manifest URL)
# --------------------------------------------------------------------------- #
class ManifestModel(BaseModel):
    """Strict parse of an extension manifest. Unknown fields are rejected."""

    model_config = ConfigDict(extra="forbid")

    api_version: str
    name: str = Field(min_length=1, max_length=160)
    version: str = Field(min_length=1, max_length=40)
    author: str = Field(min_length=1, max_length=160)
    endpoint_url: str = Field(min_length=1, max_length=2000)
    capabilities: list[str] = Field(min_length=1)
    required_permissions: list[str] = Field(default_factory=list)

    @field_validator("api_version")
    @classmethod
    def _known_api_version(cls, v: str) -> str:
        if v not in SUPPORTED_API_VERSIONS:
            raise ValueError(
                f"Unsupported api_version '{v}'. Supported: "
                f"{', '.join(sorted(SUPPORTED_API_VERSIONS))}"
            )
        return v

    @field_validator("capabilities")
    @classmethod
    def _known_capabilities(cls, v: list[str]) -> list[str]:
        unknown = [c for c in v if c not in CAPABILITIES]
        if unknown:
            raise ValueError(f"Unknown capabilities: {', '.join(unknown)}")
        return list(dict.fromkeys(v))  # dedupe, preserve order

    @field_validator("required_permissions")
    @classmethod
    def _known_permissions(cls, v: list[str]) -> list[str]:
        unknown = [p for p in v if p not in PERMISSIONS]
        if unknown:
            raise ValueError(f"Unknown permissions: {', '.join(unknown)}")
        return list(dict.fromkeys(v))


class ManifestPreview(BaseModel):
    """What the install dialog shows before the user approves."""

    name: str
    version: str
    author: str
    api_version: str
    endpoint_url: str
    capabilities: list[str]
    required_permissions: list[str]
    permission_descriptions: dict[str, str]


# --------------------------------------------------------------------------- #
# Requests from the Phonograph UI
# --------------------------------------------------------------------------- #
class ManifestPreviewRequest(BaseModel):
    manifest_url: str = Field(min_length=1, max_length=2000)


class ExtensionInstall(BaseModel):
    manifest_url: str = Field(min_length=1, max_length=2000)
    approved_permissions: list[str] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Responses to the Phonograph UI
# --------------------------------------------------------------------------- #
class ExtensionEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str
    detail: str | None
    created_at: datetime


class ExtensionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    name: str
    version: str
    author: str
    api_version: str
    manifest_url: str
    endpoint_url: str
    capabilities: list[str]
    requested_permissions: list[str]
    granted_permissions: list[str]
    status: ExtensionStatus
    needs_reapproval: bool
    last_error: str | None
    last_refresh_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ExtensionDetail(ExtensionOut):
    events: list[ExtensionEventOut] = []


class RefreshSummary(BaseModel):
    extension_id: int
    status: ExtensionStatus
    tracks_sent: int
    links_written: int
    tracks_metadata_updated: int
    message: str
    last_refresh_at: datetime | None


# --------------------------------------------------------------------------- #
# The extension's /refresh response (parsed strictly)
# --------------------------------------------------------------------------- #
class EnrichedStreamingLink(BaseModel):
    model_config = ConfigDict(extra="forbid")

    service: str
    url: str = Field(min_length=1, max_length=2000)


class RefreshResultItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ref: int
    streaming_links: list[EnrichedStreamingLink] = Field(default_factory=list)
    genre: str | None = Field(default=None, max_length=160)
    year: int | None = None


class RefreshResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    results: list[RefreshResultItem] = Field(default_factory=list)
