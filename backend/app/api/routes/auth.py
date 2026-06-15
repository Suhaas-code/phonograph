"""Authentication routes (Phase 1): register, login, OAuth, current user."""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.core.security import (
    create_access_token,
    generate_token,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.models.user import ApprovalStatus, User, UserRole
from app.schemas.auth import (
    OAuthCallbackRequest,
    OAuthUrlResponse,
    RegisterRequest,
    Token,
)
from app.schemas.user import UserOut
from app.services import oauth

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


def _bootstrap_role_and_status(db: Session, email: str) -> tuple[UserRole, ApprovalStatus]:
    """First user, or the configured admin email, becomes an approved admin."""
    is_first_user = db.scalar(select(func.count()).select_from(User)) == 0
    if is_first_user or email.lower() == settings.initial_admin_email.lower():
        return UserRole.admin, ApprovalStatus.approved
    return UserRole.user, ApprovalStatus.pending


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> User:
    existing = db.scalar(
        select(User).where(
            (User.username == payload.username) | (User.email == str(payload.email))
        )
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already registered",
        )

    role, approval = _bootstrap_role_and_status(db, str(payload.email))
    user = User(
        username=payload.username,
        email=str(payload.email),
        hashed_password=hash_password(payload.password),
        role=role,
        approval_status=approval,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("Registered user %s (role=%s, status=%s)", user.username, role, approval)
    return user


@router.post("/login", response_model=Token)
def login(
    form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
) -> Token:
    user = db.scalar(select(User).where(User.username == form.username))
    if user is None or not user.hashed_password or not verify_password(
        form.password, user.hashed_password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    return Token(access_token=create_access_token(user.id))


@router.get("/oauth/google/url", response_model=OAuthUrlResponse)
def google_oauth_url() -> OAuthUrlResponse:
    if not settings.google_oauth_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured",
        )
    return OAuthUrlResponse(authorization_url=oauth.authorization_url(state=generate_token(8)))


@router.post("/oauth/google/callback", response_model=Token)
async def google_oauth_callback(
    payload: OAuthCallbackRequest, db: Session = Depends(get_db)
) -> Token:
    if not settings.google_oauth_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured",
        )
    try:
        profile = await oauth.exchange_code(payload.code)
    except Exception as exc:  # noqa: BLE001 - surface a clean 400 to the client
        logger.warning("OAuth exchange failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="OAuth exchange failed"
        ) from exc

    user = db.scalar(
        select(User).where(
            (User.oauth_subject == profile["sub"]) | (User.email == profile["email"])
        )
    )
    if user is None:
        role, approval = _bootstrap_role_and_status(db, profile["email"])
        base_username = profile["name"].replace(" ", "_").lower()[:60] or "user"
        username = base_username
        suffix = 1
        while db.scalar(select(User).where(User.username == username)):
            suffix += 1
            username = f"{base_username}_{suffix}"
        user = User(
            username=username,
            email=profile["email"],
            role=role,
            approval_status=approval,
            oauth_provider="google",
            oauth_subject=profile["sub"],
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif user.oauth_subject is None:
        # Link OAuth identity to a pre-existing local account.
        user.oauth_provider = "google"
        user.oauth_subject = profile["sub"]
        db.commit()

    return Token(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user
