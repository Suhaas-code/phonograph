"""Bug reporting routes.

Users see and discuss only their own bug reports; admins see and discuss all
and can close/reopen them. Image attachments (<= 5 MB) are stored in the DB.
"""
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_admin_user, get_approved_user
from app.database import get_db
from app.models.bug_report import BugAttachment, BugMessage, BugReport, BugStatus
from app.models.user import User
from app.schemas.bug import (
    BugAttachmentOut,
    BugMessageOut,
    BugReportCreate,
    BugReportDetail,
    BugReportOut,
    BugStatusUpdate,
)

router = APIRouter(prefix="/bugs", tags=["bugs"])

MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}


def _visible_report(db: Session, user: User, report_id: int) -> BugReport:
    """Return the report if the user owns it or is an admin, else 404."""
    report = db.get(BugReport, report_id)
    if report is None or (report.owner_id != user.id and not user.is_admin):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bug report not found")
    return report


def _report_out(db: Session, report: BugReport) -> BugReportOut:
    count = (
        db.scalar(
            select(func.count()).select_from(BugMessage).where(BugMessage.report_id == report.id)
        )
        or 0
    )
    return BugReportOut(
        id=report.id,
        owner_id=report.owner_id,
        owner_username=report.owner.username,
        title=report.title,
        status=report.status,
        message_count=count,
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


def _detail(db: Session, report_id: int) -> BugReportDetail:
    report = db.scalar(
        select(BugReport)
        .where(BugReport.id == report_id)
        .options(
            selectinload(BugReport.owner),
            selectinload(BugReport.messages).selectinload(BugMessage.author),
            selectinload(BugReport.messages).selectinload(BugMessage.attachments),
        )
    )
    base = _report_out(db, report)
    messages = [
        BugMessageOut(
            id=m.id,
            author_id=m.author_id,
            author_username=m.author.username if m.author else "unknown",
            body=m.body,
            created_at=m.created_at,
            attachments=[BugAttachmentOut.model_validate(a) for a in m.attachments],
        )
        for m in report.messages
    ]
    return BugReportDetail(**base.model_dump(), messages=messages)


@router.get("", response_model=list[BugReportOut])
def list_reports(
    status_filter: BugStatus | None = Query(default=None, alias="status"),
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> list[BugReportOut]:
    stmt = select(BugReport).options(selectinload(BugReport.owner))
    if not user.is_admin:
        stmt = stmt.where(BugReport.owner_id == user.id)
    if status_filter is not None:
        stmt = stmt.where(BugReport.status == status_filter)
    reports = db.scalars(stmt.order_by(BugReport.updated_at.desc())).all()
    return [_report_out(db, r) for r in reports]


@router.post("", response_model=BugReportDetail, status_code=status.HTTP_201_CREATED)
def create_report(
    payload: BugReportCreate,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> BugReportDetail:
    report = BugReport(owner_id=user.id, title=payload.title, status=BugStatus.open)
    db.add(report)
    db.flush()
    if payload.body.strip():
        db.add(BugMessage(report_id=report.id, author_id=user.id, body=payload.body.strip()))
    db.commit()
    return _detail(db, report.id)


@router.get("/{report_id}", response_model=BugReportDetail)
def get_report(
    report_id: int,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> BugReportDetail:
    _visible_report(db, user, report_id)
    return _detail(db, report_id)


@router.post("/{report_id}/messages", response_model=BugReportDetail)
async def add_message(
    report_id: int,
    body: str = Form(default=""),
    images: list[UploadFile] = File(default=[]),
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> BugReportDetail:
    report = _visible_report(db, user, report_id)
    uploads = [u for u in images if u and u.filename]
    if not body.strip() and not uploads:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message must include text or an image",
        )

    message = BugMessage(report_id=report.id, author_id=user.id, body=body.strip())
    db.add(message)
    db.flush()

    for up in uploads:
        if up.content_type not in ALLOWED_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PNG, JPEG, WEBP or GIF images are allowed",
            )
        data = await up.read()
        if len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Each image must be 5 MB or smaller",
            )
        db.add(
            BugAttachment(
                message_id=message.id,
                content=data,
                content_type=up.content_type,
                filename=up.filename[:255],
                size=len(data),
            )
        )

    # Bump the report so it sorts to the top of the activity list.
    report.updated_at = func.now()
    db.commit()
    return _detail(db, report.id)


@router.post("/{report_id}/status", response_model=BugReportOut)
def set_status(
    report_id: int,
    payload: BugStatusUpdate,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> BugReportOut:
    report = db.get(BugReport, report_id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bug report not found")
    report.status = payload.status
    db.commit()
    db.refresh(report)
    return _report_out(db, report)


@router.get("/attachments/{attachment_id}")
def get_attachment(
    attachment_id: int,
    user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
) -> Response:
    attachment = db.get(BugAttachment, attachment_id)
    if attachment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    report = attachment.message.report
    if report.owner_id != user.id and not user.is_admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    return Response(
        content=attachment.content,
        media_type=attachment.content_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )
