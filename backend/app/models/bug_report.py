"""Bug reporting models: a report owns a thread of messages, each of which may
carry image attachments (stored in the database)."""
import enum

from sqlalchemy import Enum, ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin


class BugStatus(str, enum.Enum):
    open = "open"
    closed = "closed"


class BugReport(Base, TimestampMixin):
    __tablename__ = "bug_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[BugStatus] = mapped_column(
        Enum(BugStatus, name="bug_status"), default=BugStatus.open, nullable=False
    )

    owner = relationship("User")
    messages = relationship(
        "BugMessage",
        back_populates="report",
        cascade="all, delete-orphan",
        order_by="BugMessage.created_at",
    )


class BugMessage(Base, TimestampMixin):
    __tablename__ = "bug_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(
        ForeignKey("bug_reports.id", ondelete="CASCADE"), index=True, nullable=False
    )
    author_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    body: Mapped[str] = mapped_column(Text, default="", nullable=False)

    report = relationship("BugReport", back_populates="messages")
    author = relationship("User")
    attachments = relationship(
        "BugAttachment", back_populates="message", cascade="all, delete-orphan"
    )


class BugAttachment(Base, TimestampMixin):
    __tablename__ = "bug_attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    message_id: Mapped[int] = mapped_column(
        ForeignKey("bug_messages.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # Image bytes live in the DB so they survive deploys. Deferred so listing
    # message metadata never pulls the blobs.
    content: Mapped[bytes] = mapped_column(LargeBinary, deferred=True, nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False)

    message = relationship("BugMessage", back_populates="attachments")
