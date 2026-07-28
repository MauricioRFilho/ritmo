import json
import logging
import os
import time
import uuid

from fastapi import FastAPI, Request


def get_logger(name: str) -> logging.Logger:
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO"),
        format="%(message)s",
    )
    return logging.getLogger(name)


def log_event(logger: logging.Logger, service: str, event: str, **fields):
    logger.info(json.dumps({
        "timestamp_ms": int(time.time() * 1000),
        "service": service,
        "event": event,
        **fields,
    }, ensure_ascii=False, default=str))


def configure_api_logging(app: FastAPI, service: str):
    logger = get_logger(f"ritmo.{service}")

    @app.middleware("http")
    async def request_logging(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            log_event(
                logger, service, "request_failed",
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                duration_ms=int((time.perf_counter() - started) * 1000),
            )
            raise
        response.headers["X-Request-ID"] = request_id
        log_event(
            logger, service, "request_completed",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=int((time.perf_counter() - started) * 1000),
        )
        return response

