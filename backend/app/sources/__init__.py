"""Data-source factory.

The rest of the app depends only on the ``BitcoinSource`` interface, never on a
concrete implementation. This function picks the implementation at startup
based on config, which is what lets us swap "demo" for a real node with one
environment variable.
"""
from __future__ import annotations

from app.config import Settings
from app.sources.base import BitcoinSource


def build_source(settings: Settings) -> BitcoinSource:
    if settings.data_source == "rpc":
        from app.sources.rpc_source import RpcSource

        return RpcSource(settings)

    if settings.data_source == "esplora":
        from app.sources.esplora_source import EsploraSource

        return EsploraSource(settings)

    from app.sources.demo_source import DemoSource

    return DemoSource(settings)
