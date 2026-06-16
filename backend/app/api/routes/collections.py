"""Collection routes (Phase 7). User collections are editable; album/tag
collections are system-generated and read-only."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_approved_user
from app.database import get_db
from app.models.collection import Collection, CollectionItem, CollectionType
from app.models.track import Track
from app.models.user import User
from app.schemas.collection import (
    CollectionCreate,
    CollectionDetail,
    CollectionItemRequest,
    CollectionOut,
    CollectionSummary,
    CollectionUpdate,
)

router = APIRouter(prefix="/collections", tags=["collections"])


def _get_owned_collection(db: Session, user: User, collection_id: int) -> Collection:
    collection = db.get(Collection, collection_id)
    if collection is None or collection.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found"
        )
    return collection


def _ensure_editable(collection: Collection) -> None:
    if collection.system_generated:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System-generated collections cannot be modified",
        )


def _to_detail(db: Session, collection: Collection) -> CollectionDetail:
    tracks = db.scalars(
        select(Track)
        .join(CollectionItem, CollectionItem.track_id == Track.id)
        .where(CollectionItem.collection_id == collection.id)
        .order_by(Track.artist, Track.title)
    ).all()
    return CollectionDetail(
        id=collection.id,
        owner_id=collection.owner_id,
        name=collection.name,
        type=collection.type,
        created_at=collection.created_at,
        item_count=len(tracks),
        tracks=list(tracks),
    )


@router.get("", response_model=list[CollectionSummary])
def list_collections(
    type: CollectionType | None = Query(default=None),
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> list[CollectionSummary]:
    stmt = select(Collection).where(Collection.owner_id == user.id)
    if type is not None:
        stmt = stmt.where(Collection.type == type)
    collections = list(db.scalars(stmt.order_by(Collection.type, Collection.name)))

    counts = dict(
        db.execute(
            select(CollectionItem.collection_id, func.count())
            .where(CollectionItem.collection_id.in_([c.id for c in collections]))
            .group_by(CollectionItem.collection_id)
        ).all()
    ) if collections else {}

    return [
        CollectionSummary(
            id=c.id,
            owner_id=c.owner_id,
            name=c.name,
            type=c.type,
            created_at=c.created_at,
            item_count=counts.get(c.id, 0),
        )
        for c in collections
    ]


@router.post("", response_model=CollectionOut, status_code=status.HTTP_201_CREATED)
def create_collection(
    payload: CollectionCreate,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> Collection:
    collection = Collection(
        owner_id=user.id, name=payload.name, type=CollectionType.user
    )
    db.add(collection)
    db.commit()
    db.refresh(collection)
    return collection


@router.get("/{collection_id}", response_model=CollectionDetail)
def get_collection(
    collection_id: int,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> CollectionDetail:
    collection = _get_owned_collection(db, user, collection_id)
    return _to_detail(db, collection)


@router.patch("/{collection_id}", response_model=CollectionOut)
def update_collection(
    collection_id: int,
    payload: CollectionUpdate,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> Collection:
    collection = _get_owned_collection(db, user, collection_id)
    _ensure_editable(collection)
    collection.name = payload.name
    db.commit()
    db.refresh(collection)
    return collection


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_collection(
    collection_id: int,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> None:
    collection = _get_owned_collection(db, user, collection_id)
    _ensure_editable(collection)
    db.delete(collection)
    db.commit()


@router.post("/{collection_id}/tracks", response_model=CollectionDetail)
def add_track(
    collection_id: int,
    payload: CollectionItemRequest,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> CollectionDetail:
    collection = _get_owned_collection(db, user, collection_id)
    _ensure_editable(collection)

    track = db.get(Track, payload.track_id)
    if track is None or track.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found")

    exists = db.scalar(
        select(CollectionItem).where(
            CollectionItem.collection_id == collection.id,
            CollectionItem.track_id == track.id,
        )
    )
    if not exists:
        db.add(CollectionItem(collection_id=collection.id, track_id=track.id))
        db.commit()
    return _to_detail(db, collection)


@router.delete("/{collection_id}/tracks/{track_id}", response_model=CollectionDetail)
def remove_track(
    collection_id: int,
    track_id: int,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> CollectionDetail:
    collection = _get_owned_collection(db, user, collection_id)
    _ensure_editable(collection)
    item = db.scalar(
        select(CollectionItem).where(
            CollectionItem.collection_id == collection.id,
            CollectionItem.track_id == track_id,
        )
    )
    if item:
        db.delete(item)
        db.commit()
    return _to_detail(db, collection)
