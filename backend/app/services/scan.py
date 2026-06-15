"""Scan ingestion service (Phase 5).

Receives extracted metadata from the browser scanner and materializes it into
tracks + variants. The server never receives audio bytes — only metadata. A
rescan replaces the library's variants with the freshly scanned set.
"""
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.library import Library
from app.models.track import Track
from app.models.variant import Variant
from app.schemas.scan import ScannedFile
from app.services import system_collections
from app.services.track_grouping import find_or_create_track


def _clean_orphan_tracks(db: Session, owner_id: int) -> None:
    """Delete tracks that no longer have any variants."""
    orphan_ids = db.scalars(
        select(Track.id)
        .outerjoin(Variant, Variant.track_id == Track.id)
        .where(Track.owner_id == owner_id, Variant.id.is_(None))
    ).all()
    if orphan_ids:
        for track in db.scalars(select(Track).where(Track.id.in_(orphan_ids))):
            db.delete(track)
        db.flush()


def ingest_scan(
    db: Session, library: Library, files: list[ScannedFile], replace: bool = True
) -> dict:
    """Ingest scanned files into a library.

    When ``replace`` is True (a rescan), the library's existing variants are
    removed first so deletions on disk are reflected.
    """
    if replace:
        for variant in list(library.variants):
            db.delete(variant)
        db.flush()

    created_variants = 0
    for item in files:
        track = find_or_create_track(db, library.owner_id, item.artist, item.title)
        variant = Variant(
            track_id=track.id,
            library_id=library.id,
            file_path=item.file_path,
            codec=item.codec,
            container=item.container,
            bitrate=item.bitrate,
            bit_depth=item.bit_depth,
            sample_rate=item.sample_rate,
            channels=item.channels,
            duration=item.duration,
            file_size=item.file_size,
            album=item.album,
            year=item.year,
            genre=item.genre,
            track_number=item.track_number,
            disc_number=item.disc_number,
            composer=item.composer,
            publisher=item.publisher,
            replay_gain=item.replay_gain,
            comments=item.comments,
            raw_metadata=item.raw_metadata or {},
        )
        db.add(variant)
        created_variants += 1

    db.flush()
    _clean_orphan_tracks(db, library.owner_id)

    # Track count = distinct logical tracks present in this library.
    library.track_count = (
        db.scalar(
            select(func.count(func.distinct(Variant.track_id))).where(
                Variant.library_id == library.id
            )
        )
        or 0
    )
    library.last_scan = datetime.now(timezone.utc)
    db.flush()

    system_collections.rebuild_for_owner(db, library.owner_id)
    db.commit()

    return {
        "library_id": library.id,
        "variants_ingested": created_variants,
        "track_count": library.track_count,
        "last_scan": library.last_scan,
    }
