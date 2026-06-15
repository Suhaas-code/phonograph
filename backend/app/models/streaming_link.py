"""StreamingLink model: external service pointer attached to a Track."""
import enum

from sqlalchemy import Enum, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin


class StreamingService(str, enum.Enum):
    spotify = "spotify"
    tidal = "tidal"
    qobuz = "qobuz"
    deezer = "deezer"
    amazon_music = "amazon_music"
    youtube_music = "youtube_music"


class StreamingLink(Base, TimestampMixin):
    __tablename__ = "streaming_links"
    __table_args__ = (
        UniqueConstraint("track_id", "service", name="uq_streaming_track_service"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    track_id: Mapped[int] = mapped_column(
        ForeignKey("tracks.id", ondelete="CASCADE"), index=True, nullable=False
    )
    service: Mapped[StreamingService] = mapped_column(
        Enum(StreamingService, name="streaming_service"), nullable=False
    )
    url: Mapped[str] = mapped_column(Text, nullable=False)

    track = relationship("Track", back_populates="streaming_links")
