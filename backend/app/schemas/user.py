"""User schemas."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.user import ApprovalStatus, UserRole


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    role: UserRole
    approval_status: ApprovalStatus
    created_at: datetime


class ApprovalUpdate(BaseModel):
    approval_status: ApprovalStatus
