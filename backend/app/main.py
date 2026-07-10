"""FastAPI application entrypoint.

Run locally with:  uvicorn app.main:app --reload
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes import transactions
from app.sources import build_source


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
