"""Track schemas."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.variant import VariantSummary


class TrackOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    artist: str
    title: str
    normalized_artist: str
    normalized_title: str
    manual: bool
    created_at: datetime


class TrackCollectionRef(BaseModel):
    id: int
    name: str
    type: str


class TrackLibraryRef(BaseModel):
    id: int
    name: str


class TrackListItem(BaseModel):
    """Track plus its libraries/collections and best-variant audio fields."""

    id: int
    title: str
    artist: str
    manual: bool
    liked: bool = False
    libraries: list[TrackLibraryRef] = []
    collections: list[TrackCollectionRef] = []
    # Audio fields from the highest-quality variant (None if unknown).
    duration: float | None = None
    codec: str | None = None
    container: str | None = None
    bit_depth: int | None = None
    sample_rate: int | None = None
    bitrate: int | None = None
    file_size: int | None = None
    year: int | None = None
    format_label: str | None = None
    quality_tier: str | None = None


class StreamingLinkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    track_id: int
    service: str
    url: str


class TrackDetail(TrackOut):
    variants: list[VariantSummary] = []
    streaming_links: list[StreamingLinkOut] = []
    library_ids: list[int] = []
    collections: list[TrackCollectionRef] = []
    liked: bool = False


class TrackUpdate(BaseModel):
    artist: str | None = Field(default=None, min_length=1, max_length=512)
    title: str | None = Field(default=None, min_length=1, max_length=512)


class MergeRequest(BaseModel):
    source_track_id: int


class SplitRequest(BaseModel):
    variant_ids: list[int] = Field(min_length=1)
    new_artist: str = Field(min_length=1, max_length=512)
    new_title: str = Field(min_length=1, max_length=512)
