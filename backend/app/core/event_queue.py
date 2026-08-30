from __future__ import annotations

import logging
import threading
from queue import Empty, Queue
from typing import Any, Callable


logger = logging.getLogger("ingest.queue")

QueuedEvent = dict[str, Any]
EventProcessor = Callable[[QueuedEvent], None]

_event_queue: Queue[QueuedEvent | None] = Queue()
_stop_event = threading.Event()
_worker_thread: threading.Thread | None = None


def enqueue_event(event: QueuedEvent) -> None:
    _event_queue.put(event)


def get_queue_size() -> int:
    return _event_queue.qsize()


def start_event_worker(processor: EventProcessor) -> None:
    global _worker_thread

    if _worker_thread and _worker_thread.is_alive():
        return

    _stop_event.clear()

    def _run() -> None:
        logger.info("event_worker_started")
        while not _stop_event.is_set():
            try:
                item = _event_queue.get(timeout=0.5)
            except Empty:
                continue

            if item is None:
                _event_queue.task_done()
                break

            try:
                processor(item)
            except Exception:
                logger.exception("event_processing_failed")
            finally:
                _event_queue.task_done()

        logger.info("event_worker_stopped")

    _worker_thread = threading.Thread(
        target=_run,
        name="ingest-event-worker",
        daemon=True,
    )
    _worker_thread.start()


def stop_event_worker(timeout: float = 3.0) -> None:
    global _worker_thread

    if not _worker_thread:
        return

    _stop_event.set()
    _event_queue.put(None)
    _worker_thread.join(timeout=timeout)
    _worker_thread = None
