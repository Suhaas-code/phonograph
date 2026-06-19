"""Health check endpoint with connectivity checks and score tracking."""
import socket
import time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.health import HealthError, HealthRecord
from app.models.user import User

router = APIRouter(prefix="/health", tags=["health"])

# Only store a new record if the last one is older than this.
_MIN_STORE_INTERVAL_SECS = 300  # 5 minutes


def _check_db(db: Session) -> bool:
    try:
        db.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def _check_internet() -> tuple[bool, float | None]:
    """TCP connect to Cloudflare DNS (1.1.1.1:53). Returns (reachable, latency_ms)."""
    try:
        start = time.perf_counter()
        s = socket.create_connection(("1.1.1.1", 53), timeout=5)
        s.close()
        return True, round((time.perf_counter() - start) * 1000, 1)
    except OSError:
        return False, None


def _error_count_last_30min(db: Session) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=30)
    return db.scalar(
        select(func.count()).where(HealthError.created_at >= cutoff)
    ) or 0


def _compute_score(db_ok: bool, internet_ok: bool, latency_ms: float | None, errors: int) -> int:
    score = 100
    if not db_ok:
        score -= 50
    if not internet_ok:
        score -= 30
    elif latency_ms is not None:
        if latency_ms > 500:
            score -= 15
        elif latency_ms > 200:
            score -= 5
    score -= min(errors, 20)
    return max(0, score)


def _status_label(score: int) -> str:
    if score >= 90:
        return "healthy"
    if score >= 60:
        return "degraded"
    return "unhealthy"


def _maybe_store(db: Session, record: HealthRecord) -> None:
    """Store record only if we haven't stored one recently."""
    last = db.scalar(
        select(HealthRecord).order_by(HealthRecord.computed_at.desc()).limit(1)
    )
    if last is None or (
        datetime.now(timezone.utc) - last.computed_at.replace(tzinfo=timezone.utc)
    ).total_seconds() >= _MIN_STORE_INTERVAL_SECS:
        db.add(record)
        try:
            db.commit()
        except Exception:
            db.rollback()


@router.get("")
def health(db: Session = Depends(get_db)) -> dict:
    """Run connectivity checks, compute health score, persist snapshot."""
    db_ok = _check_db(db)
    internet_ok, latency_ms = _check_internet()
    errors = _error_count_last_30min(db)
    score = _compute_score(db_ok, internet_ok, latency_ms, errors)
    status = _status_label(score)

    record = HealthRecord(
        score=score,
        status=status,
        db_ok=db_ok,
        internet_ok=internet_ok,
        latency_ms=latency_ms,
        error_count=errors,
    )
    _maybe_store(db, record)

    return {
        "status": status,
        "score": score,
        "checks": {
            "database": {"status": "pass" if db_ok else "fail"},
            "internet": {
                "status": "pass" if internet_ok else "fail",
                "latency_ms": latency_ms,
            },
        },
        "error_count_30min": errors,
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/history")
def health_history(
    limit: int = 48,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Return recent health snapshots (requires auth)."""
    rows = db.scalars(
        select(HealthRecord).order_by(HealthRecord.computed_at.desc()).limit(limit)
    )
    return [
        {
            "score": r.score,
            "status": r.status,
            "db_ok": r.db_ok,
            "internet_ok": r.internet_ok,
            "latency_ms": r.latency_ms,
            "error_count": r.error_count,
            "computed_at": r.computed_at.isoformat(),
        }
        for r in rows
    ]
