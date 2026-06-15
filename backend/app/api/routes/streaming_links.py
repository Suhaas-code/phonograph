"""Streaming link routes (Phase 10): attach links, suggest existing, display."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_approved_user
from app.database import get_db
from app.models.streaming_link import StreamingLink
from app.models.track import Track
from app.models.user import User
from app.schemas.streaming_link import (
    StreamingLinkCreate,
    StreamingLinkOut,
    StreamingLinkSuggestion,
)

router = APIRouter(tags=["streaming-links"])


def _get_owned_track(db: Session, user: User, track_id: int) -> Track:
    track = db.get(Track, track_id)
    if track is None or track.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found")
    return track


@router.get("/tracks/{track_id}/streaming-links", response_model=list[StreamingLinkOut])
def list_links(
    track_id: int,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> list[StreamingLink]:
    _get_owned_track(db, user, track_id)
    return list(
        db.scalars(select(StreamingLink).where(StreamingLink.track_id == track_id))
    )


@router.post(
    "/tracks/{track_id}/streaming-links",
    response_model=StreamingLinkOut,
    status_code=status.HTTP_201_CREATED,
)
def add_link(
    track_id: int,
    payload: StreamingLinkCreate,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> StreamingLink:
    _get_owned_track(db, user, track_id)
    existing = db.scalar(
        select(StreamingLink).where(
            StreamingLink.track_id == track_id, StreamingLink.service == payload.service
        )
    )
    if existing:
        existing.url = payload.url  # one link per service: update in place
        db.commit()
        db.refresh(existing)
        return existing
    link = StreamingLink(track_id=track_id, service=payload.service, url=payload.url)
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


@router.delete("/streaming-links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_link(
    link_id: int,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> None:
    link = db.get(StreamingLink, link_id)
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link not found")
    track = db.get(Track, link.track_id)
    if track is None or track.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link not found")
    db.delete(link)
    db.commit()


@router.get(
    "/tracks/{track_id}/streaming-links/suggestions",
    response_model=list[StreamingLinkSuggestion],
)
def suggest_links(
    track_id: int,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> list[StreamingLinkSuggestion]:
    """Suggest links from other tracks (any user) sharing this track's grouping
    key, for services not already mapped on this track."""
    track = _get_owned_track(db, user, track_id)
    existing_services = {
        link.service for link in track.streaming_links
    }

    matches = db.scalars(
        select(Track).where(
            Track.normalized_artist == track.normalized_artist,
            Track.normalized_title == track.normalized_title,
            Track.id != track.id,
        )
    ).all()

    suggestions: list[StreamingLinkSuggestion] = []
    seen_services = set(existing_services)
    for other in matches:
        for link in other.streaming_links:
            if link.service in seen_services:
                continue
            seen_services.add(link.service)
            suggestions.append(
                StreamingLinkSuggestion(
                    service=link.service,
                    url=link.url,
                    source_track_id=other.id,
                    source_artist=other.artist,
                    source_title=other.title,
                )
            )
    return suggestions
