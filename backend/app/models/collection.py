"""Collection and CollectionItem models: unified grouping system."""
import enum

from sqlalchemy import Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin


class CollectionType(str, enum.Enum):
    user = "user"
    album = "album"
    tag = "tag"
    shared = "shared"


class Collection(Base, TimestampMixin):
    __tablename__ = "collections"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[CollectionType] = mapped_column(
        Enum(CollectionType, name="collection_type"),
        default=CollectionType.user,
        nullable=False,
    )

    owner = relationship("User", back_populates="collections")
    items = relationship(
        "CollectionItem", back_populates="collection", cascade="all, delete-orphan"
    )
    shares = relationship("Share", back_populates="collection", cascade="all, delete-orphan")

    @property
    def system_generated(self) -> bool:
        return self.type in (CollectionType.album, CollectionType.tag)


class CollectionItem(Base, TimestampMixin):
    __tablename__ = "collection_items"
    __table_args__ = (
        UniqueConstraint("collection_id", "track_id", name="uq_collection_track"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    collection_id: Mapped[int] = mapped_column(
        ForeignKey("collections.id", ondelete="CASCADE"), index=True, nullable=False
    )
    track_id: Mapped[int] = mapped_column(
        ForeignKey("tracks.id", ondelete="CASCADE"), index=True, nullable=False
    )

    collection = relationship("Collection", back_populates="items")
    track = relationship("Track")
