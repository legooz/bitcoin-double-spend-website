"""Self-contained demo data source.

Serves a small set of sample transactions and *simulates* the Bitcoin network
so the app is fully functional with no node, no internet, and no blockchain
download. The probability math is the real thing — only the block data is
synthetic. This is what makes the project deployable as a public demo.
"""
from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path
from typing import AsyncIterator

from app.config import Settings
from app.models import (
    HistoryResponse,
    HistoryView,
    ProbabilityPoint,
    ProbabilityUpdate,
    SampleTransaction,
    TransactionInput,
    TransactionOutput,
    TransactionSummary,
)
from app.probability.equations import p_double_spend_if_accepted_now
from app.probability.lttb import choose_threshold, downsample

_FIXTURE_PATH = Path(__file__).resolve().parents[2] / "fixtures" / "demo_transactions.json"

# Real-network average: one block roughly every 10 minutes.
_AVG_BLOCK_SECONDS = 600
_HISTORY_CONFIRMATIONS = 40
_FIVE_HOURS_SECONDS = 5 * 60 * 60
_FIRST_5H_STEP_SECONDS = 5  # fine resolution through the decay region
_NEGLIGIBLE_PROBABILITY = 1e-6  # stop adding points once risk is this close to zero


class DemoSource:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._fixtures: dict[str, dict] = {}
        raw = json.loads(_FIXTURE_PATH.read_text())
        for entry in raw:
            self._fixtures[entry["txid"].lower()] = entry

    def _find(self, txid: str) -> dict | None:
        return self._fixtures.get(txid.lower())

    def list_samples(self) -> list[SampleTransaction]:
        return [
            SampleTransaction(txid=entry["txid"], label=entry["label"])
            for entry in self._fixtures.values()
        ]

    async def sample_mempool_txid(self) -> str | None:
        return None  # demo uses static samples, not the live mempool

    async def largest_mining_pool(self) -> dict | None:
        # Static stand-in so the preset works offline in demo mode. The name
        # renders after "Current largest pool:" in the UI.
        return {"name": "unknown", "share": 0.25}

    async def sample_confirmed_txid(self) -> str | None:
        return None  # demo uses static samples

    async def get_transaction(self, txid: str, alpha: float) -> TransactionSummary | None:
        entry = self._find(txid)
        if entry is None:
            return None

        now = int(time.time())
        is_coinbase = entry.get("is_coinbase", False)
        probability = 0.0 if is_coinbase else p_double_spend_if_accepted_now(0, 0, alpha)

        return TransactionSummary(
            txid=entry["txid"],
            confirmations=0,
            inputs=[TransactionInput(**i) for i in entry.get("inputs", [])],
            outputs=[TransactionOutput(**o) for o in entry.get("outputs", [])],
            blockhash=entry.get("blockhash", ""),
            time=now,
            blocktime=now,
            alpha=alpha,
            probability=probability,
            is_coinbase=is_coinbase,
            label=entry.get("label"),
        )

    async def stream_probability(self, txid: str, alpha: float) -> AsyncIterator[ProbabilityUpdate]:
        entry = self._find(txid)
        if entry is None or entry.get("is_coinbase", False):
            return

        block_seconds = self._settings.demo_block_seconds
        max_confirmations = self._settings.demo_max_confirmations
        start = time.monotonic()

        while True:
            elapsed = time.monotonic() - start
            confirmations = min(int(elapsed // block_seconds), max_confirmations)
            probability = p_double_spend_if_accepted_now(elapsed, confirmations, alpha)

            yield ProbabilityUpdate(
                confirmations=confirmations,
                probability=probability,
                elapsed_time=elapsed,
            )

            if confirmations >= max_confirmations or probability <= 1e-9:
                return
            await asyncio.sleep(0.5)

    async def get_history(
        self, txid: str, alpha: float, lttb_threshold: int | None
    ) -> HistoryResponse | None:
        entry = self._find(txid)
        if entry is None or entry.get("is_coinbase", False):
            return None

        included_block_time = int(time.time()) - _HISTORY_CONFIRMATIONS * _AVG_BLOCK_SECONDS

        # One point per (simulated) block, stopping once risk is negligible.
        full_rows: list[tuple[float, float]] = []
        for confirmations in range(1, _HISTORY_CONFIRMATIONS + 1):
            elapsed = (confirmations - 1) * _AVG_BLOCK_SECONDS
            probability = p_double_spend_if_accepted_now(elapsed, confirmations, alpha)
            full_rows.append((float(elapsed), float(probability)))
            if probability <= _NEGLIGIBLE_PROBABILITY:
                break

        # First 5 hours: fine resolution through the decay, then stop once the risk
        # has stayed negligible for a full block (the flat tail carries no info).
        first_5h_limit = min(_FIVE_HOURS_SECONDS, (_HISTORY_CONFIRMATIONS - 1) * _AVG_BLOCK_SECONDS)
        first_5h_rows: list[tuple[float, float]] = []
        negligible_since: int | None = None
        for second in range(0, first_5h_limit + 1, _FIRST_5H_STEP_SECONDS):
            confirmations = min(1 + second // _AVG_BLOCK_SECONDS, _HISTORY_CONFIRMATIONS)
            probability = p_double_spend_if_accepted_now(second, confirmations, alpha)
            first_5h_rows.append((float(second), float(probability)))
            if probability <= _NEGLIGIBLE_PROBABILITY:
                if negligible_since is None:
                    negligible_since = second
                elif second - negligible_since >= _AVG_BLOCK_SECONDS:
                    break
            else:
                negligible_since = None

        return HistoryResponse(
            txid=entry["txid"],
            included_block_height=800_000,
            included_block_time=included_block_time,
            alpha=alpha,
            full_graph=_to_view(full_rows, lttb_threshold),
            first_5h=_to_view(first_5h_rows, lttb_threshold),
        )


def _to_view(rows: list[tuple[float, float]], lttb_threshold: int | None) -> HistoryView:
    threshold = choose_threshold(len(rows), lttb_threshold)
    sampled = downsample(rows, threshold)
    return HistoryView(
        points=[ProbabilityPoint(elapsed_seconds=x, probability=y) for x, y in sampled]
    )
