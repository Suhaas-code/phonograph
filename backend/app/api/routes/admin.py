"""Admin routes (Phase 1): user approval workflow."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_admin_user
from app.database import get_db
from app.models.user import ApprovalStatus, User
from app.schemas.user import ApprovalUpdate, UserOut

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[UserOut])
def list_users(
    pending_only: bool = False,
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> list[User]:
    stmt = select(User).order_by(User.created_at.desc())
    if pending_only:
        stmt = stmt.where(User.approval_status == ApprovalStatus.pending)
    return list(db.scalars(stmt))


@router.patch("/users/{user_id}/approval", response_model=UserOut)
def set_approval(
    user_id: int,
    payload: ApprovalUpdate,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == admin.id and payload.approval_status != ApprovalStatus.approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admins cannot revoke their own approval",
        )
    user.approval_status = payload.approval_status
    db.commit()
    db.refresh(user)
    return user
