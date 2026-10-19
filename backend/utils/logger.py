import logging
import queue
import json
import asyncio
import threading
from datetime import datetime
from sse_starlette.sse import ServerSentEvent

# ─── Per-user queues for authenticated SSE log streaming ──────────
_log_subscribers: dict[int, tuple[str, queue.Queue]] = {}
_subscriber_lock = threading.Lock()


class QueueHandler(logging.Handler):
    """Pushes formatted log records into log_queue for SSE consumers."""

    def emit(self, record):
        try:
            msg = self.format(record)
            with _subscriber_lock:
                subscribers = list(_log_subscribers.values())
            for uid, subscriber in subscribers:
                if f"[{uid}]" not in msg and f"[{uid}/" not in msg:
                    continue
                try:
                    subscriber.put_nowait(msg)
                except queue.Full:
                    continue
        except Exception:
            self.handleError(record)


# ─── Logger setup ─────────────────────────────────────────────────
logger = logging.getLogger("flowml")
logger.setLevel(logging.INFO)

_console_handler = logging.StreamHandler()
_console_handler.setLevel(logging.INFO)

_queue_handler = QueueHandler()
_queue_handler.setLevel(logging.INFO)

_formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
_console_handler.setFormatter(_formatter)
_queue_handler.setFormatter(_formatter)

logger.addHandler(_console_handler)
logger.addHandler(_queue_handler)


# ─── Async SSE generator ──────────────────────────────────────────
async def stream_logs(uid: str):
    """
    Async generator that streams log messages to an SSE client.

    IMPORTANT: Uses run_in_executor so the blocking queue.get() call
    never blocks the asyncio event loop — without this, all other API
    requests would stall while a console client is connected.
    """
    subscriber = queue.Queue(maxsize=250)
    subscriber_id = id(subscriber)
    with _subscriber_lock:
        _log_subscribers[subscriber_id] = (uid, subscriber)
    loop = asyncio.get_running_loop()
    try:
        yield ServerSentEvent(
            data=json.dumps(
                {
                    "message": "Log streaming connected",
                    "level": "INFO",
                    "timestamp": datetime.now().isoformat(),
                }
            )
        )

        while True:
            try:
                log_msg = await loop.run_in_executor(
                    None, lambda: subscriber.get(timeout=2.0)
                )
                yield ServerSentEvent(
                    data=json.dumps({"log": log_msg, "timestamp": datetime.now().isoformat()})
                )
            except queue.Empty:
                yield ServerSentEvent(comment="ping")
    finally:
        with _subscriber_lock:
            _log_subscribers.pop(subscriber_id, None)


# ─── Convenience logger ───────────────────────────────────────────
def log_event(message: str, level: str = "INFO") -> None:
    """Log a message at the given level and push it to the SSE queue."""
    lvl = level.upper()
    if lvl == "INFO":
        logger.info(message)
    elif lvl == "ERROR":
        logger.error(message)
    elif lvl == "WARNING":
        logger.warning(message)
    else:
        logger.debug(message)
