"""Application configuration, loaded from environment variables.

Everything that used to be hard-coded (RPC credentials, CORS origins, the
worker's data source) now lives here and is driven by env vars, so the same
code runs locally, in Docker, and in the cloud without edits.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="DSCAP_",
        extra="ignore",
    )

    # "demo" = self-contained simulated data (no node required, safe to deploy).
    # "rpc"  = talk to a real, fully-synced Bitcoin Core node (needs txindex=1).
    data_source: str = "demo"

    # Comma-separated list of allowed browser origins for CORS.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Bitcoin Core JSON-RPC settings (only used when data_source == "rpc").
    rpc_user: str = ""
    rpc_password: str = ""
    rpc_host: str = "127.0.0.1"
    rpc_port: int = 8332

    # Esplora / mempool.space REST API base (used when data_source == "esplora").
    # mempool.space and blockstream.info both serve this same API.
    esplora_base_url: str = "https://mempool.space/api"

    # Demo-mode tuning: how fast simulated blocks arrive and when to stop.
    demo_block_seconds: float = 12.0
    demo_max_confirmations: int = 15
    default_alpha: float = 0.15

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def rpc_url(self) -> str:
        return f"http://{self.rpc_user}:{self.rpc_password}@{self.rpc_host}:{self.rpc_port}/"


@lru_cache
def get_settings() -> Settings:
    """Cached so the environment is parsed once per process."""
    return Settings()
