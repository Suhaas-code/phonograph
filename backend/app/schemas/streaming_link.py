"""Streaming link schemas."""
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.streaming_link import normalize_service


class StreamingLinkCreate(BaseModel):
    # Any provider key: a well-known service or a custom one the user types.
    service: str = Field(min_length=1, max_length=60)
    url: str = Field(min_length=1, max_length=2000)

    @field_validator("service")
    @classmethod
    def _normalize(cls, v: str) -> str:
        normalized = normalize_service(v)
        if not normalized:
            raise ValueError("Provider name is required")
        return normalized


class StreamingLinkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    track_id: int
    service: str
    url: str


class StreamingLinkSuggestion(BaseModel):
    service: str
    url: str
    source_track_id: int
    source_artist: str
    source_title: str
