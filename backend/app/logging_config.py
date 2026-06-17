"""Application logging: write all logs (app + uvicorn, including errors) to
``deploy/server.log`` as well as the console."""
import logging
from pathlib import Path

# Repo root is two levels up from app/ (app -> backend -> repo root).
LOG_PATH = Path(__file__).resolve().parents[2] / "deploy" / "server.log"

_FORMAT = "%(asctime)s %(levelname)s %(name)s %(message)s"


def setup_logging(level: int = logging.INFO) -> Path:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    formatter = logging.Formatter(_FORMAT)

    # Append mode is multi-worker safe (no rotation races); rotate via logrotate
    # if needed later.
    file_handler = logging.FileHandler(LOG_PATH, mode="a", encoding="utf-8")
    file_handler.setFormatter(formatter)
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers = [file_handler, console_handler]

    # uvicorn keeps its own loggers; point them at the same handlers so request
    # and server errors also land in the file.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(name)
        lg.handlers = [file_handler, console_handler]
        lg.propagate = False

    return LOG_PATH
