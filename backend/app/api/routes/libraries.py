"""Library management routes (Phase 5)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_approved_user
from app.api.serializers import variant_summary
from app.database import get_db
from app.models.library import Library
from app.models.track import Track
from app.models.user import User
from app.models.variant import Variant
from app.schemas.library import (
    LibraryCreate,
    LibraryOut,
    LibraryStats,
    LibraryUpdate,
)
from app.schemas.scan import ScanRequest, ScanResult
from app.schemas.track import TrackDetail
from app.services import variant_quality
from app.services.scan import ingest_scan

router = APIRouter(prefix="/libraries", tags=["libraries"])


def _get_owned_library(db: Session, user: User, library_id: int) -> Library:
    library = db.get(Library, library_id)
    if library is None or library.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Library not found")
    return library


@router.get("", response_model=list[LibraryOut])
def list_libraries(
    user: User = Depends(get_approved_user), db: Session = Depends(get_db)
) -> list[Library]:
    return list(
        db.scalars(
            select(Library).where(Library.owner_id == user.id).order_by(Library.name)
        )
    )


@router.post("", response_model=LibraryOut, status_code=status.HTTP_201_CREATED)
def create_library(
    payload: LibraryCreate,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> Library:
    library = Library(owner_id=user.id, name=payload.name, description=payload.description)
    db.add(library)
    db.commit()
    db.refresh(library)
    return library


@router.get("/{library_id}", response_model=LibraryOut)
def get_library(
    library_id: int,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> Library:
    return _get_owned_library(db, user, library_id)


@router.patch("/{library_id}", response_model=LibraryOut)
def update_library(
    library_id: int,
    payload: LibraryUpdate,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> Library:
    library = _get_owned_library(db, user, library_id)
    if payload.name is not None:
        library.name = payload.name
    if payload.description is not None:
        library.description = payload.description
    db.commit()
    db.refresh(library)
    return library


@router.delete("/{library_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_library(
    library_id: int,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> None:
    library = _get_owned_library(db, user, library_id)
    db.delete(library)
    db.commit()


@router.post("/{library_id}/scan", response_model=ScanResult)
def scan_library(
    library_id: int,
    payload: ScanRequest,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> ScanResult:
    """Ingest scanned metadata. ``replace=True`` performs a full rescan."""
    library = _get_owned_library(db, user, library_id)
    result = ingest_scan(db, library, payload.files, replace=payload.replace)
    return ScanResult(**result)


@router.get("/{library_id}/tracks", response_model=list[TrackDetail])
def library_tracks(
    library_id: int,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> list[TrackDetail]:
    library = _get_owned_library(db, user, library_id)
    variants = db.scalars(
        select(Variant)
        .where(Variant.library_id == library.id)
        .options(selectinload(Variant.track).selectinload(Track.streaming_links))
    ).all()

    by_track: dict[int, list[Variant]] = {}
    for v in variants:
        by_track.setdefault(v.track_id, []).append(v)

    details: list[TrackDetail] = []
    for track_id, vs in by_track.items():
        track = vs[0].track
        ordered = variant_quality.sort_variants(vs)
        details.append(
            TrackDetail(
                id=track.id,
                artist=track.artist,
                title=track.title,
                normalized_artist=track.normalized_artist,
                normalized_title=track.normalized_title,
                manual=track.manual,
                created_at=track.created_at,
                variants=[variant_summary(v) for v in ordered],
                streaming_links=track.streaming_links,
                library_ids=[library.id],
            )
        )
    details.sort(key=lambda d: (d.artist.lower(), d.title.lower()))
    return details


@router.get("/{library_id}/stats", response_model=LibraryStats)
def library_stats(
    library_id: int,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> LibraryStats:
    library = _get_owned_library(db, user, library_id)
    variants = db.scalars(
        select(Variant).where(Variant.library_id == library.id)
    ).all()

    track_count = db.scalar(
        select(func.count(func.distinct(Variant.track_id))).where(
            Variant.library_id == library.id
        )
    ) or 0

    by_codec: dict[str, int] = {}
    by_tier: dict[str, int] = {}
    total_size = 0
    total_duration = 0.0
    for v in variants:
        by_codec[(v.codec or "unknown").lower()] = by_codec.get((v.codec or "unknown").lower(), 0) + 1
        tier = variant_quality.quality_tier(v)
        by_tier[tier] = by_tier.get(tier, 0) + 1
        total_size += v.file_size or 0
        total_duration += v.duration or 0.0

    return LibraryStats(
        library_id=library.id,
        track_count=track_count,
        variant_count=len(variants),
        total_size_bytes=total_size,
        total_duration_seconds=round(total_duration, 2),
        by_codec=dict(sorted(by_codec.items())),
        by_tier=dict(sorted(by_tier.items())),
    )
