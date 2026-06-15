"""Variant model: a physical file version of a Track within a Library."""
from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin


class Variant(Base, TimestampMixin):
    __tablename__ = "variants"
    __table_args__ = (
        # A given file path can appear once per library; lets rescans upsert.
        UniqueConstraint("library_id", "file_path", name="uq_variant_library_path"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    track_id: Mapped[int] = mapped_column(
        ForeignKey("tracks.id", ondelete="CASCADE"), index=True, nullable=False
    )
    library_id: Mapped[int] = mapped_column(
        ForeignKey("libraries.id", ondelete="CASCADE"), index=True, nullable=False
    )

    # Identity of the file within the library.
    file_path: Mapped[str] = mapped_column(Text, nullable=False)

    # Audio characteristics (used for quality ranking).
    codec: Mapped[str | None] = mapped_column(String(40), nullable=True)
    container: Mapped[str | None] = mapped_column(String(40), nullable=True)
    bitrate: Mapped[int | None] = mapped_column(Integer, nullable=True)  # kbps
    bit_depth: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sample_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Hz
    channels: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration: Mapped[float | None] = mapped_column(Float, nullable=True)  # seconds
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)  # bytes

    # Descriptive metadata.
    album: Mapped[str | None] = mapped_column(String(512), nullable=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    genre: Mapped[str | None] = mapped_column(String(160), nullable=True)
    track_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    disc_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    composer: Mapped[str | None] = mapped_column(String(512), nullable=True)
    publisher: Mapped[str | None] = mapped_column(String(255), nullable=True)
    replay_gain: Mapped[str | None] = mapped_column(String(80), nullable=True)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Raw tags exactly as extracted by the scanner, preserved verbatim.
    raw_metadata: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    # True when manually pinned to its track by a split/merge; auto-grouper skips it.
    pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    track = relationship("Track", back_populates="variants")
    library = relationship("Library", back_populates="variants")
