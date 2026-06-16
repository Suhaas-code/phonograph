"""Track routes (Phase 4 grouping + Phase 6 variant management)."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_approved_user
from app.api.serializers import build_track_list_items, variant_summary
from app.database import get_db
from app.models.collection import Collection, CollectionItem, CollectionType
from app.models.track import Track
from app.models.user import User
from app.models.variant import Variant
from app.schemas.track import (
    MergeRequest,
    SplitRequest,
    TrackCollectionRef,
    TrackDetail,
    TrackListItem,
    TrackUpdate,
)
from app.schemas.variant import VariantSummary
from app.services import variant_quality
from app.services.liked import LIKED_NAME, get_or_create_liked
from app.services.normalization import normalize_artist, normalize_title
from app.services.track_grouping import merge_tracks, split_variants

router = APIRouter(prefix="/tracks", tags=["tracks"])


def _get_owned_track(db: Session, user: User, track_id: int) -> Track:
    track = db.get(Track, track_id)
    if track is None or track.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found")
    return track


def _to_detail(db: Session, track: Track) -> TrackDetail:
    ordered = variant_quality.sort_variants(list(track.variants))
    collections: list[TrackCollectionRef] = []
    liked = False
    for cid, cname, ctype in db.execute(
        select(Collection.id, Collection.name, Collection.type)
        .join(CollectionItem, CollectionItem.collection_id == Collection.id)
        .where(CollectionItem.track_id == track.id)
        .order_by(Collection.type, Collection.name)
    ).all():
        if ctype == CollectionType.user and cname == LIKED_NAME:
            liked = True
            continue
        collections.append(TrackCollectionRef(id=cid, name=cname, type=ctype.value))

    return TrackDetail(
        id=track.id,
        artist=track.artist,
        title=track.title,
        normalized_artist=track.normalized_artist,
        normalized_title=track.normalized_title,
        manual=track.manual,
        created_at=track.created_at,
        variants=[variant_summary(v) for v in ordered],
        streaming_links=track.streaming_links,
        library_ids=sorted({v.library_id for v in track.variants}),
        collections=collections,
        liked=liked,
    )


@router.get("", response_model=list[TrackListItem])
def list_tracks(
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
    limit: int = Query(default=200, le=1000),
    offset: int = 0,
) -> list[TrackListItem]:
    """List the owner's tracks with libraries, collections, and best-variant info."""
    tracks = list(
        db.scalars(
            select(Track)
            .where(Track.owner_id == user.id)
            .order_by(Track.title, Track.artist)
            .limit(limit)
            .offset(offset)
        )
    )
    return build_track_list_items(db, tracks)


@router.get("/{track_id}", response_model=TrackDetail)
def get_track(
    track_id: int,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> TrackDetail:
    track = db.scalar(
        select(Track)
        .where(Track.id == track_id, Track.owner_id == user.id)
        .options(
            selectinload(Track.variants).selectinload(Variant.library),
            selectinload(Track.streaming_links),
        )
    )
    if track is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found")
    return _to_detail(db, track)


@router.patch("/{track_id}", response_model=TrackDetail)
def update_track(
    track_id: int,
    payload: TrackUpdate,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> TrackDetail:
    track = _get_owned_track(db, user, track_id)
    if payload.artist is not None:
        track.artist = payload.artist
        track.normalized_artist = normalize_artist(payload.artist)
    if payload.title is not None:
        track.title = payload.title
        track.normalized_title = normalize_title(payload.title)
    track.manual = True
    db.commit()
    db.refresh(track)
    return _to_detail(db, track)


@router.post("/{track_id}/merge", response_model=TrackDetail)
def merge(
    track_id: int,
    payload: MergeRequest,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> TrackDetail:
    """Merge ``source_track_id`` into this track (manual grouping override)."""
    target = _get_owned_track(db, user, track_id)
    source = _get_owned_track(db, user, payload.source_track_id)
    if source.id == target.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot merge a track into itself"
        )
    merge_tracks(db, target, source)
    db.commit()
    db.refresh(target)
    return _to_detail(db, target)


@router.post("/{track_id}/split", response_model=TrackDetail)
def split(
    track_id: int,
    payload: SplitRequest,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> TrackDetail:
    """Pull variants out of this track into a new manual track."""
    track = _get_owned_track(db, user, track_id)
    owned_variant_ids = {v.id for v in track.variants}
    if not set(payload.variant_ids).issubset(owned_variant_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more variants do not belong to this track",
        )
    try:
        new_track = split_variants(
            db, track, payload.variant_ids, payload.new_artist, payload.new_title
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    db.commit()
    db.refresh(new_track)
    return _to_detail(db, new_track)


@router.get("/{track_id}/variants", response_model=list[VariantSummary])
def track_variants(
    track_id: int,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> list[VariantSummary]:
    track = _get_owned_track(db, user, track_id)
    ordered = variant_quality.sort_variants(list(track.variants))
    return [variant_summary(v) for v in ordered]


@router.get("/{track_id}/comparison")
def variant_comparison(
    track_id: int,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> dict:
    """Quality-ordered variants for a track, with the best variant flagged and a
    per-library best summary (Phase 6 comparison view)."""
    track = _get_owned_track(db, user, track_id)
    ordered = variant_quality.sort_variants(list(track.variants))
    best_id = ordered[0].id if ordered else None

    per_library: dict[int, Variant] = {}
    for v in ordered:
        if v.library_id not in per_library:
            per_library[v.library_id] = v  # ordered best-first, so first wins

    return {
        "track": {"id": track.id, "artist": track.artist, "title": track.title},
        "best_variant_id": best_id,
        "variants": [
            {**variant_summary(v).model_dump(), "is_best": v.id == best_id}
            for v in ordered
        ],
        "per_library_best": [
            {
                "library_id": lib_id,
                "library_name": v.library.name if v.library else None,
                "format_label": variant_quality.format_label(v),
                "is_overall_best": v.id == best_id,
            }
            for lib_id, v in per_library.items()
        ],
    }


@router.post("/{track_id}/like")
def like_track(
    track_id: int,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> dict:
    """Add the track to the user's (auto-created) Liked Songs collection."""
    track = _get_owned_track(db, user, track_id)
    liked = get_or_create_liked(db, user.id)
    exists = db.scalar(
        select(CollectionItem).where(
            CollectionItem.collection_id == liked.id, CollectionItem.track_id == track.id
        )
    )
    if not exists:
        db.add(CollectionItem(collection_id=liked.id, track_id=track.id))
        db.commit()
    return {"liked": True}


@router.delete("/{track_id}/like")
def unlike_track(
    track_id: int,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> dict:
    track = _get_owned_track(db, user, track_id)
    liked = get_or_create_liked(db, user.id)
    item = db.scalar(
        select(CollectionItem).where(
            CollectionItem.collection_id == liked.id, CollectionItem.track_id == track.id
        )
    )
    if item:
        db.delete(item)
        db.commit()
    return {"liked": False}
