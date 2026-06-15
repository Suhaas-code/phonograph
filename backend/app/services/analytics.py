"""Library analysis engine (Phase 9).

Cross-library questions: missing tracks, missing/duplicate variants, library
comparison, and quality distribution. All quality reasoning routes through
``variant_quality`` so every view agrees on ranking.
"""
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.library import Library
from app.models.track import Track
from app.models.variant import Variant
from app.services import variant_quality


def _owner_variants(db: Session, owner_id: int) -> list[Variant]:
    return list(
        db.scalars(
            select(Variant)
            .join(Variant.track)
            .where(Track.owner_id == owner_id)
            .options(selectinload(Variant.track))
        )
    )


def _track_label(track: Track) -> dict:
    return {"id": track.id, "artist": track.artist, "title": track.title}


def missing_tracks(db: Session, owner_id: int, source_id: int, target_id: int) -> list[dict]:
    """Tracks present in the source library but absent from the target library."""
    source_tracks = set(
        db.scalars(
            select(Variant.track_id).where(Variant.library_id == source_id)
        ).all()
    )
    target_tracks = set(
        db.scalars(
            select(Variant.track_id).where(Variant.library_id == target_id)
        ).all()
    )
    missing_ids = source_tracks - target_tracks
    if not missing_ids:
        return []
    tracks = db.scalars(
        select(Track).where(Track.id.in_(missing_ids), Track.owner_id == owner_id)
    ).all()
    return [_track_label(t) for t in sorted(tracks, key=lambda t: (t.artist, t.title))]


def compare_libraries(db: Session, owner_id: int, a_id: int, b_id: int) -> dict:
    a_name = db.scalar(select(Library.name).where(Library.id == a_id))
    b_name = db.scalar(select(Library.name).where(Library.id == b_id))
    a_tracks = set(db.scalars(select(Variant.track_id).where(Variant.library_id == a_id)).all())
    b_tracks = set(db.scalars(select(Variant.track_id).where(Variant.library_id == b_id)).all())

    both = a_tracks & b_tracks
    return {
        "library_a": {"id": a_id, "name": a_name},
        "library_b": {"id": b_id, "name": b_name},
        "only_in_a": missing_tracks(db, owner_id, a_id, b_id),
        "only_in_b": missing_tracks(db, owner_id, b_id, a_id),
        "in_both_count": len(both),
    }


def missing_variants(db: Session, owner_id: int) -> list[dict]:
    """For tracks in 2+ libraries, report libraries holding a lower-quality best
    variant than the best available across the user's libraries (upgrade gaps)."""
    variants = _owner_variants(db, owner_id)
    by_track: dict[int, list[Variant]] = defaultdict(list)
    for v in variants:
        by_track[v.track_id].append(v)

    results = []
    for track_id, vs in by_track.items():
        libs = {v.library_id for v in vs}
        if len(libs) < 2:
            continue
        overall_best = variant_quality.sort_variants(vs)[0]
        best_key = variant_quality.quality_key(overall_best)

        below = []
        per_library_best: dict[int, Variant] = {}
        for v in vs:
            cur = per_library_best.get(v.library_id)
            if cur is None or variant_quality.quality_key(v) > variant_quality.quality_key(cur):
                per_library_best[v.library_id] = v
        for lib_id, v in per_library_best.items():
            if variant_quality.quality_key(v) < best_key:
                below.append(
                    {
                        "library_id": lib_id,
                        "library_name": v.library.name if v.library else None,
                        "current_format": variant_quality.format_label(v),
                    }
                )
        if below:
            results.append(
                {
                    "track": _track_label(overall_best.track),
                    "best_format": variant_quality.format_label(overall_best),
                    "best_library_id": overall_best.library_id,
                    "libraries_below_best": below,
                }
            )
    results.sort(key=lambda r: (r["track"]["artist"], r["track"]["title"]))
    return results


def duplicate_variants(db: Session, owner_id: int) -> list[dict]:
    """Same track represented by more than one variant within one library."""
    variants = _owner_variants(db, owner_id)
    grouped: dict[tuple[int, int], list[Variant]] = defaultdict(list)
    for v in variants:
        grouped[(v.track_id, v.library_id)].append(v)

    results = []
    for (track_id, library_id), vs in grouped.items():
        if len(vs) < 2:
            continue
        ordered = variant_quality.sort_variants(vs)
        results.append(
            {
                "track": _track_label(ordered[0].track),
                "library_id": library_id,
                "library_name": ordered[0].library.name if ordered[0].library else None,
                "count": len(vs),
                "variants": [
                    {
                        "id": v.id,
                        "format": variant_quality.format_label(v),
                        "file_path": v.file_path,
                    }
                    for v in ordered
                ],
            }
        )
    results.sort(key=lambda r: (r["track"]["artist"], r["track"]["title"]))
    return results


def library_matrix(db: Session, owner_id: int) -> dict:
    """Compare ALL of the owner's libraries at once.

    Returns one column per library and one row per track that is NOT present in
    every library (the diffs). Each cell reports presence and the best format
    held in that library, so missing copies (−) and upgrade context are visible
    side by side.
    """
    libraries = list(
        db.scalars(
            select(Library).where(Library.owner_id == owner_id).order_by(Library.name)
        )
    )
    lib_ids = [lib.id for lib in libraries]
    libraries_out = [{"id": lib.id, "name": lib.name} for lib in libraries]

    if len(lib_ids) < 1:
        return {"libraries": libraries_out, "rows": [], "diff_count": 0, "total_tracks": 0}

    variants = _owner_variants(db, owner_id)
    best_by_track_lib: dict[int, dict[int, Variant]] = defaultdict(dict)
    track_obj: dict[int, Track] = {}
    for v in variants:
        track_obj[v.track_id] = v.track
        current = best_by_track_lib[v.track_id].get(v.library_id)
        if current is None or variant_quality.quality_key(v) > variant_quality.quality_key(current):
            best_by_track_lib[v.track_id][v.library_id] = v

    rows = []
    for track_id, lib_map in best_by_track_lib.items():
        # Skip tracks present in every library — they are not a difference.
        if len(lib_map) == len(lib_ids):
            continue
        track = track_obj[track_id]
        presence = {}
        for lib_id in lib_ids:
            v = lib_map.get(lib_id)
            presence[str(lib_id)] = {
                "present": v is not None,
                "format_label": variant_quality.format_label(v) if v else None,
            }
        rows.append(
            {
                "track": _track_label(track),
                "present_count": len(lib_map),
                "presence": presence,
            }
        )

    rows.sort(key=lambda r: (r["track"]["artist"].lower(), r["track"]["title"].lower()))
    return {
        "libraries": libraries_out,
        "rows": rows,
        "diff_count": len(rows),
        "total_tracks": len(best_by_track_lib),
    }


def quality_distribution(db: Session, owner_id: int, library_id: int | None = None) -> dict:
    """Count variants per quality tier (optionally scoped to one library)."""
    variants = _owner_variants(db, owner_id)
    if library_id is not None:
        variants = [v for v in variants if v.library_id == library_id]

    tiers: dict[str, int] = defaultdict(int)
    codecs: dict[str, int] = defaultdict(int)
    for v in variants:
        tiers[variant_quality.quality_tier(v)] += 1
        codecs[(v.codec or "unknown").lower()] += 1
    return {
        "total_variants": len(variants),
        "by_tier": dict(sorted(tiers.items())),
        "by_codec": dict(sorted(codecs.items())),
    }
