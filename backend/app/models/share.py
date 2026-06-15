"""Share model: grants access to a collection via token or to a specific user."""
import enum

from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin


class SharePermission(str, enum.Enum):
    view = "view"


class Share(Base, TimestampMixin):
    __tablename__ = "shares"

    id: Mapped[int] = mapped_column(primary_key=True)
    collection_id: Mapped[int] = mapped_column(
        ForeignKey("collections.id", ondelete="CASCADE"), index=True, nullable=False
    )
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # Public-ish share token (still requires an approved, authenticated account).
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    # Optional direct grant to a specific approved user.
    shared_with_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    permission: Mapped[SharePermission] = mapped_column(
        Enum(SharePermission, name="share_permission"),
        default=SharePermission.view,
        nullable=False,
    )

    collection = relationship("Collection", back_populates="shares")
