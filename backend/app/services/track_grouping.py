"""Track grouping engine (Phase 4).

Groups variants into logical tracks by normalized artist/title within a single
owner's catalog. Supports manual merge (combine two tracks) and manual split
(pull variants out into their own track) with overrides that survive rescans.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.track import Track
from app.models.variant import Variant
from app.services.normalization import grouping_key, normalize_artist, normalize_title


def find_or_create_track(
    db: Session, owner_id: int, artist: str, title: str
) -> Track:
    """Return the track for this artist/title within the owner's catalog.

    Matches on the primary grouping key first, then on any track that was
    manually merged to absorb this key (``merged_keys``). Creates a new track
    when nothing matches.
    """
    n_artist = normalize_artist(artist)
    n_title = normalize_title(title)
    key = grouping_key(n_artist, n_title)

    track = db.scalar(
        select(Track).where(
            Track.owner_id == owner_id,
            Track.normalized_artist == n_artist,
            Track.normalized_title == n_title,
        )
    )
    if track:
        return track

    # Honor prior manual merges: a track may have absorbed this key.
    for candidate in db.scalars(
        select(Track).where(Track.owner_id == owner_id, Track.merged_keys.contains([key]))
    ):
        return candidate

    track = Track(
        owner_id=owner_id,
        artist=artist or "Unknown Artist",
        title=title or "Unknown Title",
        normalized_artist=n_artist,
        normalized_title=n_title,
    )
    db.add(track)
    db.flush()
    return track


def merge_tracks(db: Session, target: Track, source: Track) -> Track:
    """Merge ``source`` into ``target``: move variants/links, remember the key."""
    if target.id == source.id:
        return target

    # Reassign via the relationship so the variant moves out of source.variants
    # (assigning the FK directly would trip the delete-orphan cascade on delete).
    for variant in list(source.variants):
        variant.track = target
    for link in list(source.streaming_links):
        # Avoid violating the (track, service) uniqueness constraint.
        exists = any(l.service == link.service for l in target.streaming_links)
        if exists:
            source.streaming_links.remove(link)
            db.delete(link)
        else:
            link.track = target

    keys = set(target.merged_keys or [])
    keys.add(source.grouping_key)
    keys.update(source.merged_keys or [])
    keys.discard(target.grouping_key)
    target.merged_keys = sorted(keys)
    target.manual = True

    db.flush()
    db.delete(source)
    db.flush()
    return target


def split_variants(
    db: Session, source: Track, variant_ids: list[int], new_artist: str, new_title: str
) -> Track:
    """Pull the given variants out of ``source`` into a new manual track."""
    new_track = Track(
        owner_id=source.owner_id,
        artist=new_artist or source.artist,
        title=new_title or source.title,
        normalized_artist=normalize_artist(new_artist or source.artist),
        normalized_title=normalize_title(new_title or source.title),
        manual=True,
    )
    db.add(new_track)
    db.flush()

    moved = 0
    for variant in list(source.variants):
        if variant.id in variant_ids:
            # Reassign through the relationship so it leaves source.variants.
            variant.track = new_track
            variant.pinned = True
            moved += 1

    if moved == 0:
        db.delete(new_track)
        db.flush()
        raise ValueError("No matching variants to split from this track")

    db.flush()
    # Clean up the source track if it has no variants left.
    if not source.variants:
        db.delete(source)
    db.flush()
    return new_track
