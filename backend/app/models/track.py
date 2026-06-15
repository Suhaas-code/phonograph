"""Track model: a logical song identity, deduplicated across libraries.

Grouping key is ``normalized_artist + normalized_title``. Tracks are scoped to
their owner so cross-library analytics (missing tracks, etc.) operate within a
single user's catalog. ``merged_keys`` records grouping keys that were manually
merged into this track, so rescans keep merged tracks together. ``manual`` marks
tracks created by a manual split/merge so the auto-grouper leaves them alone.
"""
from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin


class Track(Base, TimestampMixin):
    __tablename__ = "tracks"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    artist: Mapped[str] = mapped_column(String(512), nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    normalized_artist: Mapped[str] = mapped_column(String(512), index=True, nullable=False)
    normalized_title: Mapped[str] = mapped_column(String(512), index=True, nullable=False)

    merged_keys: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    manual: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    owner = relationship("User", back_populates="tracks")
    variants = relationship("Variant", back_populates="track", cascade="all, delete-orphan")
    streaming_links = relationship(
        "StreamingLink", back_populates="track", cascade="all, delete-orphan"
    )

    @property
    def grouping_key(self) -> str:
        return f"{self.normalized_artist}\x1f{self.normalized_title}"
