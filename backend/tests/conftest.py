"""Test-suite configuration.

The API tests exercise the demo data source, but a developer's local ``.env``
may select ``esplora`` or ``rpc`` (pydantic-settings reads it as a fallback).
Pin the data source via a real environment variable, which takes priority over
the ``.env`` file, so ``pytest`` is deterministic on every machine. This runs
before any test module imports ``app.main``.
"""
import os

os.environ["DSCAP_DATA_SOURCE"] = "demo"

from app.config import get_settings  # noqa: E402

# In case a settings object was already built (e.g. by an editor/test-runner
# preloading the app), drop it so the pinned environment is what gets used.
get_settings.cache_clear()
