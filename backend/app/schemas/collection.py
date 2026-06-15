"""Collection schemas."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.collection import CollectionType
from app.schemas.track import TrackOut


class CollectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class CollectionUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class CollectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    name: str
    type: CollectionType
    created_at: datetime


class CollectionDetail(CollectionOut):
    item_count: int = 0
    tracks: list[TrackOut] = []


class CollectionItemRequest(BaseModel):
    track_id: int
