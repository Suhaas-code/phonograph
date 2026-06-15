"""System-generated collections (Phase 7): Albums and Tags.

These are derived from variant metadata and rebuilt after every scan. Albums
group tracks by album name; Tags group tracks by genre. User and shared
collections are never touched here.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.collection import Collection, CollectionItem, CollectionType
from app.models.variant import Variant


def _replace_collections(
    db: Session, owner_id: int, ctype: CollectionType, grouped: dict[str, set[int]]
) -> None:
    # Remove existing system collections of this type for the owner.
    existing = db.scalars(
        select(Collection).where(
            Collection.owner_id == owner_id, Collection.type == ctype
        )
    ).all()
    for col in existing:
        db.delete(col)
    db.flush()

    for name, track_ids in sorted(grouped.items()):
        if not name or not track_ids:
            continue
        collection = Collection(owner_id=owner_id, name=name, type=ctype)
        db.add(collection)
        db.flush()
        for track_id in sorted(track_ids):
            db.add(CollectionItem(collection_id=collection.id, track_id=track_id))
    db.flush()


def rebuild_for_owner(db: Session, owner_id: int) -> None:
    """Regenerate Album and Tag collections from the owner's variants."""
    rows = db.execute(
        select(Variant.track_id, Variant.album, Variant.genre)
        .join(Variant.track)
        .where(Variant.track.has(owner_id=owner_id))
    ).all()

    albums: dict[str, set[int]] = {}
    tags: dict[str, set[int]] = {}
    for track_id, album, genre in rows:
        if album and album.strip():
            albums.setdefault(album.strip(), set()).add(track_id)
        if genre and genre.strip():
            tags.setdefault(genre.strip(), set()).add(track_id)

    _replace_collections(db, owner_id, CollectionType.album, albums)
    _replace_collections(db, owner_id, CollectionType.tag, tags)
