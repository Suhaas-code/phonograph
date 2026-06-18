"""StreamingLink model: external service pointer attached to a Track.

``service`` is a free-form provider key so links from any provider can be stored
— the platform's well-known services (below) plus extension-supplied or
user-typed custom providers.
"""
from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin

# Well-known services we show friendly labels/suggestions for. Not a restriction:
# any provider key may be stored.
KNOWN_SERVICES = [
    "spotify",
    "tidal",
    "qobuz",
    "deezer",
    "amazon_music",
    "youtube_music",
]


def normalize_service(value: str) -> str:
    """Canonical provider key: trimmed, lower-cased, single-spaced."""
    return " ".join((value or "").strip().lower().split())


class StreamingLink(Base, TimestampMixin):
    __tablename__ = "streaming_links"
    __table_args__ = (
        UniqueConstraint("track_id", "service", name="uq_streaming_track_service"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    track_id: Mapped[int] = mapped_column(
        ForeignKey("tracks.id", ondelete="CASCADE"), index=True, nullable=False
    )
    service: Mapped[str] = mapped_column(String(60), nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)

    track = relationship("Track", back_populates="streaming_links")
