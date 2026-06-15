"""Library schemas."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LibraryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str | None = None


class LibraryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = None


class LibraryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    name: str
    description: str | None
    last_scan: datetime | None
    track_count: int
    created_at: datetime


class LibraryStats(BaseModel):
    library_id: int
    track_count: int
    variant_count: int
    total_size_bytes: int
    total_duration_seconds: float
    by_codec: dict[str, int]
    by_tier: dict[str, int]
