"""Bug reporting schemas."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.bug_report import BugStatus


class BugAttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    content_type: str
    size: int


class BugMessageOut(BaseModel):
    id: int
    author_id: int
    author_username: str
    body: str
    created_at: datetime
    attachments: list[BugAttachmentOut] = []


class BugReportOut(BaseModel):
    id: int
    owner_id: int
    owner_username: str
    title: str
    status: BugStatus
    message_count: int
    created_at: datetime
    updated_at: datetime


class BugReportDetail(BugReportOut):
    messages: list[BugMessageOut] = []


class BugReportCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(default="", max_length=5000)


class BugStatusUpdate(BaseModel):
    status: BugStatus
