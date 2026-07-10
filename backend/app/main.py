"""FastAPI application entrypoint.

Run locally with:  uvicorn app.main:app --reload
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.config import get_settings
from app.routes import transactions
from app.sources import build_source


def _client_key(request: Request) -> str:
    # Behind Render/Vercel the real client IP is in X-Forwarded-For; fall back to
    # the direct peer address for local runs.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)


# Per-IP rate limit. Protects the demo (and the upstream public API it proxies)
# from abuse. Generous enough for normal interactive use.
limiter = Limiter(key_func=_client_key, default_limits=["120/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    # Pick the data source once at startup and share it across all requests.
    app.state.source = build_source(settings)
    app.state.settings = settings
    yield
    close = getattr(app.state.source, "aclose", None)
    if close is not None:
        await close()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="DSCap API", version="2.0.0", lifespan=lifespan)

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

    # CORS is added last so it stays outermost and attaches headers to every
    # response, including 429s from the rate limiter.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(transactions.router)

    @app.get("/health", tags=["meta"])
    async def health() -> dict[str, str]:
        return {"status": "ok", "data_source": settings.data_source}

    return app


app = create_app()
