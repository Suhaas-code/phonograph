"""Sharing schemas."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.collection import CollectionDetail


class ShareCreate(BaseModel):
    # Optional direct grant to a specific approved user by username.
    shared_with_username: str | None = None


class ShareOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    collection_id: int
    owner_id: int
    token: str
    shared_with_user_id: int | None
    permission: str
    created_at: datetime


class SharedCollectionView(BaseModel):
    share_token: str
    owner_username: str
    collection: CollectionDetail
