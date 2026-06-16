"""Variant schemas."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class VariantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    track_id: int
    library_id: int
    file_path: str
    codec: str | None
    container: str | None
    bitrate: int | None
    bit_depth: int | None
    sample_rate: int | None
    channels: int | None
    duration: float | None
    file_size: int | None
    album: str | None
    year: int | None
    genre: str | None
    track_number: int | None
    disc_number: int | None
    composer: str | None
    publisher: str | None
    replay_gain: str | None
    comments: str | None
    raw_metadata: dict
    pinned: bool
    created_at: datetime


class VariantSummary(BaseModel):
    """Variant with derived quality fields for display/comparison."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    track_id: int
    library_id: int
    library_name: str | None = None
    codec: str | None
    container: str | None
    bitrate: int | None
    bit_depth: int | None
    sample_rate: int | None
    channels: int | None
    duration: float | None
    file_size: int | None
    year: int | None = None
    format_label: str
    quality_tier: str
    lossless: bool
