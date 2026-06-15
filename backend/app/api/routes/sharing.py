"""Sharing routes (Phase 8). Only approved users may access shared content."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_approved_user
from app.api.routes.collections import _to_detail
from app.core.security import generate_token
from app.database import get_db
from app.models.collection import Collection
from app.models.share import Share
from app.models.user import User
from app.schemas.share import ShareCreate, SharedCollectionView, ShareOut

router = APIRouter(prefix="/shares", tags=["sharing"])


@router.post(
    "/collections/{collection_id}",
    response_model=ShareOut,
    status_code=status.HTTP_201_CREATED,
)
def share_collection(
    collection_id: int,
    payload: ShareCreate,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> Share:
    collection = db.get(Collection, collection_id)
    if collection is None or collection.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found"
        )

    shared_with_user_id = None
    if payload.shared_with_username:
        target = db.scalar(
            select(User).where(User.username == payload.shared_with_username)
        )
        if target is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Target user not found"
            )
        if not target.is_approved:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot share with an unapproved user",
            )
        shared_with_user_id = target.id

    share = Share(
        collection_id=collection.id,
        owner_id=user.id,
        token=generate_token(24),
        shared_with_user_id=shared_with_user_id,
    )
    db.add(share)
    db.commit()
    db.refresh(share)
    return share


@router.get("", response_model=list[ShareOut])
def list_my_shares(
    user: User = Depends(get_approved_user), db: Session = Depends(get_db)
) -> list[Share]:
    """Shares I created plus shares granted directly to me."""
    return list(
        db.scalars(
            select(Share).where(
                (Share.owner_id == user.id) | (Share.shared_with_user_id == user.id)
            )
        )
    )


@router.delete("/{share_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_share(
    share_id: int,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> None:
    share = db.get(Share, share_id)
    if share is None or share.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share not found")
    db.delete(share)
    db.commit()


@router.get("/view/{token}", response_model=SharedCollectionView)
def view_shared_collection(
    token: str,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> SharedCollectionView:
    """View a shared collection. Requires an approved account; if the share was
    granted to a specific user, only that user (or the owner) may view it."""
    share = db.scalar(select(Share).where(Share.token == token))
    if share is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share not found")

    if share.shared_with_user_id is not None and user.id not in (
        share.shared_with_user_id,
        share.owner_id,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this shared collection",
        )

    collection = db.get(Collection, share.collection_id)
    if collection is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Collection no longer exists"
        )
    owner = db.get(User, share.owner_id)
    return SharedCollectionView(
        share_token=token,
        owner_username=owner.username if owner else "unknown",
        collection=_to_detail(db, collection),
    )
