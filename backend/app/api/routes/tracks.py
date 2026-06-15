"""Track routes (Phase 4 grouping + Phase 6 variant management)."""
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_approved_user
from app.api.serializers import variant_summary
from app.database import get_db
from app.models.collection import Collection, CollectionItem
from app.models.library import Library
from app.models.track import Track
from app.models.user import User
from app.models.variant import Variant
from app.schemas.track import (
    MergeRequest,
    SplitRequest,
    TrackCollectionRef,
    TrackDetail,
    TrackLibraryRef,
    TrackListItem,
    TrackUpdate,
)
from app.schemas.variant import VariantSummary
from app.services import variant_quality
from app.services.normalization import normalize_artist, normalize_title
from app.services.track_grouping import merge_tracks, split_variants

router = APIRouter(prefix="/tracks", tags=["tracks"])


def _get_owned_track(db: Session, user: User, track_id: int) -> Track:
    track = db.get(Track, track_id)
    if track is None or track.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found")
    return track


def _to_detail(track: Track) -> TrackDetail:
    ordered = variant_quality.sort_variants(list(track.variants))
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
    )


@router.get("", response_model=list[TrackListItem])
def list_tracks(
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
    limit: int = Query(default=200, le=1000),
    offset: int = 0,
) -> list[TrackListItem]:
    """List the owner's tracks with the libraries and collections each appears in."""
    tracks = list(
        db.scalars(
            select(Track)
            .where(Track.owner_id == user.id)
            .order_by(Track.title, Track.artist)
            .limit(limit)
            .offset(offset)
        )
    )
    track_ids = [t.id for t in tracks]

    libs_by_track: dict[int, list[TrackLibraryRef]] = defaultdict(list)
    cols_by_track: dict[int, list[TrackCollectionRef]] = defaultdict(list)
    if track_ids:
        lib_rows = db.execute(
            select(Variant.track_id, Library.id, Library.name)
            .join(Library, Library.id == Variant.library_id)
            .where(Variant.track_id.in_(track_ids))
            .distinct()
        ).all()
        for track_id, lib_id, lib_name in lib_rows:
            libs_by_track[track_id].append(TrackLibraryRef(id=lib_id, name=lib_name))

        col_rows = db.execute(
            select(CollectionItem.track_id, Collection.id, Collection.name, Collection.type)
            .join(Collection, Collection.id == CollectionItem.collection_id)
            .where(CollectionItem.track_id.in_(track_ids))
            .order_by(Collection.type, Collection.name)
        ).all()
        for track_id, col_id, col_name, col_type in col_rows:
            cols_by_track[track_id].append(
                TrackCollectionRef(id=col_id, name=col_name, type=col_type.value)
            )

    return [
        TrackListItem(
            id=t.id,
            title=t.title,
            artist=t.artist,
            manual=t.manual,
            libraries=sorted(libs_by_track.get(t.id, []), key=lambda l: l.name.lower()),
            collections=cols_by_track.get(t.id, []),
        )
        for t in tracks
    ]


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
    return _to_detail(track)


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
    return _to_detail(track)


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
    return _to_detail(target)


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
    return _to_detail(new_track)


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
