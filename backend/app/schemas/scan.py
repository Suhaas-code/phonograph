"""Schemas for scanned metadata uploaded by the browser scanner (Phase 3)."""
from pydantic import BaseModel, Field


class ScannedFile(BaseModel):
    """One audio file's extracted metadata. No audio bytes are ever included."""

    # Required.
    title: str = Field(default="", description="Track title; may be empty if untagged")
    artist: str = Field(default="", description="Artist; may be empty if untagged")
    file_path: str = Field(description="Relative path within the scanned folder")

    # Extended.
    album: str | None = None
    year: int | None = None
    genre: str | None = None
    track_number: int | None = None
    disc_number: int | None = None
    duration: float | None = None
    codec: str | None = None
    container: str | None = None
    bitrate: int | None = None
    bit_depth: int | None = None
    sample_rate: int | None = None
    channels: int | None = None
    file_size: int | None = None

    # Optional.
    composer: str | None = None
    publisher: str | None = None
    replay_gain: str | None = None
    comments: str | None = None

    # Raw tags exactly as extracted, preserved verbatim.
    raw_metadata: dict = Field(default_factory=dict)


class ScanRequest(BaseModel):
    files: list[ScannedFile]
    replace: bool = True


class ScanResult(BaseModel):
    library_id: int
    variants_ingested: int
    track_count: int
    last_scan: object | None = None
