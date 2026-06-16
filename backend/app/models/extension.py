"""Extension framework models.

An ``Extension`` is a per-user registration of an external service described by a
fetched manifest (name, version, author, capabilities, endpoint URL, required
permissions). Phonograph is only an HTTP client of the service — it never runs
extension code and never sends or receives audio. ``ExtensionEvent`` records a
lightweight audit/status history (install, enable, disable, update, refresh,
error, remove).
"""
import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin

# The contract version this server speaks. Manifests must match.
SUPPORTED_API_VERSIONS = {"1.0"}

# Capabilities an extension may advertise (what it can do).
CAPABILITIES = {
    "metadata.refresh",
    "streaming_links.resolve",
    "enrichment.tags",
}

# Permissions an extension may request (what data it may read / write). The
# server defines the vocabulary; extensions may only ask for these.
PERMISSIONS = {
    "read:tracks",
    "read:libraries",
    "write:streaming_links",
    "write:track_metadata",
}


class ExtensionStatus(str, enum.Enum):
    enabled = "enabled"
    disabled = "disabled"
    error = "error"


class Extension(Base, TimestampMixin):
    __tablename__ = "extensions"
    __table_args__ = ()

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )

    # Manifest-derived identity.
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    version: Mapped[str] = mapped_column(String(40), nullable=False)
    author: Mapped[str] = mapped_column(String(160), nullable=False)
    api_version: Mapped[str] = mapped_column(String(20), nullable=False)

    manifest_url: Mapped[str] = mapped_column(Text, nullable=False)
    endpoint_url: Mapped[str] = mapped_column(Text, nullable=False)

    capabilities: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    requested_permissions: Mapped[list[str]] = mapped_column(
        JSONB, default=list, nullable=False
    )
    granted_permissions: Mapped[list[str]] = mapped_column(
        JSONB, default=list, nullable=False
    )

    status: Mapped[ExtensionStatus] = mapped_column(
        Enum(ExtensionStatus, name="extension_status"),
        default=ExtensionStatus.enabled,
        nullable=False,
    )
    # Set when an Update introduces new permissions; refresh is blocked until the
    # user re-approves.
    needs_reapproval: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_refresh_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Raw validated manifest, kept so Update can diff against what was installed.
    manifest_snapshot: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    # Phonograph-issued secret used to sign outbound requests so the extension can
    # verify they came from this instance. Never exposed via the API.
    shared_secret: Mapped[str] = mapped_column(String(128), nullable=False)

    owner = relationship("User")
    events = relationship(
        "ExtensionEvent",
        back_populates="extension",
        cascade="all, delete-orphan",
        order_by="ExtensionEvent.created_at.desc()",
    )


class ExtensionEvent(Base, TimestampMixin):
    __tablename__ = "extension_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    extension_id: Mapped[int] = mapped_column(
        ForeignKey("extensions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)

    extension = relationship("Extension", back_populates="events")
