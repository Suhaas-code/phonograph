"""Search and analytics routes (Phase 9)."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_approved_user
from app.database import get_db
from app.models.library import Library
from app.models.track import Track
from app.models.user import User
from app.models.variant import Variant
from app.schemas.track import TrackOut
from app.services import analytics

router = APIRouter(tags=["search-analytics"])


@router.get("/search", response_model=list[TrackOut])
def search(
    q: str = Query(min_length=1),
    field: str = Query(
        default="all",
        pattern="^(all|artist|track|album|genre|codec)$",
        description="One of: all, artist, track, album, genre, codec",
    ),
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
    limit: int = Query(default=100, le=500),
) -> list[Track]:
    term = f"%{q.lower()}%"
    stmt = select(Track).where(Track.owner_id == user.id).distinct()

    if field == "artist":
        stmt = stmt.where(func.lower(Track.artist).like(term))
    elif field == "track":
        stmt = stmt.where(func.lower(Track.title).like(term))
    elif field in ("album", "genre", "codec"):
        column = {"album": Variant.album, "genre": Variant.genre, "codec": Variant.codec}[field]
        stmt = stmt.join(Variant, Variant.track_id == Track.id).where(
            func.lower(column).like(term)
        )
    else:  # all
        stmt = stmt.outerjoin(Variant, Variant.track_id == Track.id).where(
            or_(
                func.lower(Track.artist).like(term),
                func.lower(Track.title).like(term),
                func.lower(Variant.album).like(term),
                func.lower(Variant.genre).like(term),
                func.lower(Variant.codec).like(term),
            )
        )

    return list(db.scalars(stmt.order_by(Track.artist, Track.title).limit(limit)))


# --- Analytics ---------------------------------------------------------------

def _check_library(db: Session, user: User, library_id: int) -> None:
    lib = db.get(Library, library_id)
    if lib is None or lib.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Library {library_id} not found"
        )


@router.get("/analytics/missing-tracks")
def missing_tracks(
    source_library_id: int,
    target_library_id: int,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> dict:
    """Tracks present in source but missing from target."""
    _check_library(db, user, source_library_id)
    _check_library(db, user, target_library_id)
    items = analytics.missing_tracks(db, user.id, source_library_id, target_library_id)
    return {
        "source_library_id": source_library_id,
        "target_library_id": target_library_id,
        "count": len(items),
        "tracks": items,
    }


@router.get("/analytics/library-matrix")
def library_matrix(
    user: User = Depends(get_approved_user), db: Session = Depends(get_db)
) -> dict:
    """All-library comparison matrix: diffs only, one column per library."""
    return analytics.library_matrix(db, user.id)


@router.get("/analytics/compare")
def compare_libraries(
    library_a_id: int,
    library_b_id: int,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> dict:
    _check_library(db, user, library_a_id)
    _check_library(db, user, library_b_id)
    return analytics.compare_libraries(db, user.id, library_a_id, library_b_id)


@router.get("/analytics/missing-variants")
def missing_variants(
    user: User = Depends(get_approved_user), db: Session = Depends(get_db)
) -> dict:
    items = analytics.missing_variants(db, user.id)
    return {"count": len(items), "items": items}


@router.get("/analytics/duplicate-variants")
def duplicate_variants(
    user: User = Depends(get_approved_user), db: Session = Depends(get_db)
) -> dict:
    items = analytics.duplicate_variants(db, user.id)
    return {"count": len(items), "items": items}


@router.get("/analytics/quality-distribution")
def quality_distribution(
    library_id: int | None = Query(default=None),
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> dict:
    if library_id is not None:
        _check_library(db, user, library_id)
    return analytics.quality_distribution(db, user.id, library_id)
