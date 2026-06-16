"""Helpers that turn ORM objects into response schemas with derived fields."""
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.collection import Collection, CollectionItem, CollectionType
from app.models.library import Library
from app.models.track import Track
from app.models.variant import Variant
from app.schemas.track import TrackCollectionRef, TrackLibraryRef, TrackListItem
from app.schemas.variant import VariantSummary
from app.services import variant_quality
from app.services.liked import LIKED_NAME


def variant_summary(v: Variant) -> VariantSummary:
    return VariantSummary(
        id=v.id,
        track_id=v.track_id,
        library_id=v.library_id,
        library_name=v.library.name if v.library else None,
        codec=v.codec,
        container=v.container,
        bitrate=v.bitrate,
        bit_depth=v.bit_depth,
        sample_rate=v.sample_rate,
        channels=v.channels,
        duration=v.duration,
        file_size=v.file_size,
        year=v.year,
        format_label=variant_quality.format_label(v),
        quality_tier=variant_quality.quality_tier(v),
        lossless=variant_quality.is_lossless(v.codec),
    )


def build_track_list_items(db: Session, tracks: list[Track]) -> list[TrackListItem]:
    """Build list items for tracks: libraries, (non-liked) collections, the
    best variant's audio fields, and whether the track is liked. Uses a few bulk
    queries to avoid N+1."""
    track_ids = [t.id for t in tracks]
    libs_by_track: dict[int, list[TrackLibraryRef]] = defaultdict(list)
    cols_by_track: dict[int, list[TrackCollectionRef]] = defaultdict(list)
    liked_ids: set[int] = set()
    best_by_track: dict[int, Variant] = {}

    if track_ids:
        for tid, lid, lname in db.execute(
            select(Variant.track_id, Library.id, Library.name)
            .join(Library, Library.id == Variant.library_id)
            .where(Variant.track_id.in_(track_ids))
            .distinct()
        ).all():
            libs_by_track[tid].append(TrackLibraryRef(id=lid, name=lname))

        for tid, cid, cname, ctype in db.execute(
            select(CollectionItem.track_id, Collection.id, Collection.name, Collection.type)
            .join(Collection, Collection.id == CollectionItem.collection_id)
            .where(CollectionItem.track_id.in_(track_ids))
            .order_by(Collection.type, Collection.name)
        ).all():
            if ctype == CollectionType.user and cname == LIKED_NAME:
                liked_ids.add(tid)  # represented by the heart, not a badge
                continue
            cols_by_track[tid].append(TrackCollectionRef(id=cid, name=cname, type=ctype.value))

        for v in db.scalars(select(Variant).where(Variant.track_id.in_(track_ids))):
            cur = best_by_track.get(v.track_id)
            if cur is None or variant_quality.quality_key(v) > variant_quality.quality_key(cur):
                best_by_track[v.track_id] = v

    items: list[TrackListItem] = []
    for t in tracks:
        best = best_by_track.get(t.id)
        items.append(
            TrackListItem(
                id=t.id,
                title=t.title,
                artist=t.artist,
                manual=t.manual,
                liked=t.id in liked_ids,
                libraries=sorted(libs_by_track.get(t.id, []), key=lambda l: l.name.lower()),
                collections=cols_by_track.get(t.id, []),
                duration=best.duration if best else None,
                codec=best.codec if best else None,
                container=best.container if best else None,
                bit_depth=best.bit_depth if best else None,
                sample_rate=best.sample_rate if best else None,
                bitrate=best.bitrate if best else None,
                file_size=best.file_size if best else None,
                year=best.year if best else None,
                format_label=variant_quality.format_label(best) if best else None,
                quality_tier=variant_quality.quality_tier(best) if best else None,
            )
        )
    return items
