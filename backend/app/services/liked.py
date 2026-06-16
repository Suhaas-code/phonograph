"""The per-user "Liked Songs" collection.

Implemented as a reserved-name user collection (no schema change). It is created
lazily, cannot be renamed or deleted, and the heart toggle adds/removes its
items.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.collection import Collection, CollectionType

LIKED_NAME = "Liked Songs"


def get_or_create_liked(db: Session, owner_id: int) -> Collection:
    collection = db.scalar(
        select(Collection).where(
            Collection.owner_id == owner_id,
            Collection.type == CollectionType.user,
            Collection.name == LIKED_NAME,
        )
    )
    if collection is None:
        collection = Collection(owner_id=owner_id, name=LIKED_NAME, type=CollectionType.user)
        db.add(collection)
        db.commit()
        db.refresh(collection)
    return collection


def is_liked_collection(collection: Collection) -> bool:
    return collection.type == CollectionType.user and collection.name == LIKED_NAME
