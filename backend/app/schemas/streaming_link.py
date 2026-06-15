"""Streaming link schemas."""
from pydantic import BaseModel, ConfigDict

from app.models.streaming_link import StreamingService


class StreamingLinkCreate(BaseModel):
    service: StreamingService
    url: str


class StreamingLinkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    track_id: int
    service: StreamingService
    url: str


class StreamingLinkSuggestion(BaseModel):
    service: StreamingService
    url: str
    source_track_id: int
    source_artist: str
    source_title: str
