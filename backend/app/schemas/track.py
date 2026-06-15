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
    """Track plus the libraries and collections it appears in (list view)."""

    id: int
    title: str
    artist: str
    manual: bool
    libraries: list[TrackLibraryRef] = []
    collections: list[TrackCollectionRef] = []


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


class TrackUpdate(BaseModel):
    artist: str | None = Field(default=None, min_length=1, max_length=512)
    title: str | None = Field(default=None, min_length=1, max_length=512)


class MergeRequest(BaseModel):
    source_track_id: int


class SplitRequest(BaseModel):
    variant_ids: list[int] = Field(min_length=1)
    new_artist: str = Field(min_length=1, max_length=512)
    new_title: str = Field(min_length=1, max_length=512)
