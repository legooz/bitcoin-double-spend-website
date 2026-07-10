"""Real mainnet data via the Esplora REST API (mempool.space / blockstream.info).

Gives live Bitcoin data with no node, no API key, and no cost. Crucially it
supports **mempool (unconfirmed) transactions**, which is where double-spend
risk actually matters — the app can watch a freshly-broadcast transaction's
risk decay in real time until it confirms.

Endpoints used (all verified public, no key):
  GET /tx/:txid                     transaction inputs/outputs + status
  GET /blocks/tip/height            current chain tip (to derive confirmations)
  GET /mempool/txids                a live unconfirmed txid to showcase
  GET /v1/transaction-times?txId[]= first-seen time (mempool.space extension)

Confirmation updates are polled instead of using ZMQ, matching the node source.
"""
from __future__ import annotations

import asyncio
import time
from typing import AsyncIterator

import httpx

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

_SATS_PER_BTC = 100_000_000
_AVG_BLOCK_SECONDS = 600
_HISTORY_MAX_CONFIRMATIONS = 100
_FIVE_HOURS_SECONDS = 5 * 60 * 60


class EsploraSource:
    def __init__(self, settings: Settings) -> None:
        self._base = settings.esplora_base_url.rstrip("/")
        self._client = httpx.AsyncClient(timeout=20.0)

    async def aclose(self) -> None:
        await self._client.aclose()

    # --- HTTP helpers -------------------------------------------------------

    async def _get_json(self, path: str):
        response = await self._client.get(f"{self._base}{path}")
        if response.status_code == 404:
            return None
        response.raise_for_status()
        return response.json()

    async def _get_text(self, path: str) -> str:
        response = await self._client.get(f"{self._base}{path}")
        response.raise_for_status()
        return response.text.strip()

    async def _tip_height(self) -> int:
        return int(await self._get_text("/blocks/tip/height"))

    async def _first_seen(self, txid: str) -> int:
        # mempool.space extension; fall back to "now" so other providers still work.
        try:
            data = await self._get_json(f"/v1/transaction-times?txId[]={txid}")
            if data and data[0]:
                return int(data[0])
        except Exception:  # noqa: BLE001
            pass
        return int(time.time())

    # --- BitcoinSource interface -------------------------------------------

    def list_samples(self) -> list[SampleTransaction]:
        # Real mode has no static samples; the frontend offers a live mempool
        # transaction via sample_mempool_txid() instead.
        return []

    async def sample_mempool_txid(self) -> str | None:
        # Prefer a recently-broadcast transaction (first-seen ~now) so the live
        # decay starts fresh, rather than an old stuck low-fee transaction.
        try:
            recent = await self._get_json("/mempool/recent")
            if recent:
                return recent[0]["txid"]
        except Exception:  # noqa: BLE001
            pass
        try:
            txids = await self._get_json("/mempool/txids")
        except Exception:  # noqa: BLE001
            return None
        return txids[0] if txids else None

    async def get_transaction(self, txid: str, alpha: float) -> TransactionSummary | None:
        tx = await self._get_json(f"/tx/{txid}")
        if tx is None:
            return None

        status = tx.get("status", {})
        confirmed = status.get("confirmed", False)
        vin = tx.get("vin", [])
        is_coinbase = bool(vin and vin[0].get("is_coinbase"))

        if is_coinbase:
            inputs = [TransactionInput(address="COINBASE", value=None)]
        else:
            inputs = []
            for entry in vin:
                prevout = entry.get("prevout") or {}
                inputs.append(
                    TransactionInput(
                        address=prevout.get("scriptpubkey_address"),
                        value=(prevout.get("value") or 0) / _SATS_PER_BTC,
                    )
                )

        outputs = [
            TransactionOutput(
                value=(out.get("value") or 0) / _SATS_PER_BTC,
                addresses=[out.get("scriptpubkey_address")],
            )
            for out in tx.get("vout", [])
        ]

        if confirmed:
            block_time = status.get("block_time", -1)
            block_height = status.get("block_height")
            tip = await self._tip_height()
            confirmations = tip - block_height + 1 if block_height else 0
            blockhash = status.get("block_hash", "")
            blocktime = block_time
            time_seen = block_time
        else:
            confirmations = 0
            blockhash = ""
            blocktime = await self._first_seen(txid)
            time_seen = blocktime

        probability = 0.0
        if not is_coinbase and blocktime > 0:
            elapsed = max(0.0, time.time() - blocktime)
            probability = p_double_spend_if_accepted_now(elapsed, confirmations, alpha)

        return TransactionSummary(
            txid=tx["txid"],
            confirmations=confirmations,
            inputs=inputs,
            outputs=outputs,
            blockhash=blockhash,
            time=time_seen,
            blocktime=blocktime,
            alpha=alpha,
            probability=probability,
            is_coinbase=is_coinbase,
        )

    async def stream_probability(self, txid: str, alpha: float) -> AsyncIterator[ProbabilityUpdate]:
        summary = await self.get_transaction(txid, alpha)
        if summary is None or summary.is_coinbase or summary.blocktime <= 0:
            return

        blocktime = summary.blocktime
        confirmations = summary.confirmations
        confirmed = summary.blockhash != ""
        ticks = 0

        while True:
            elapsed = max(0.0, time.time() - blocktime)
            probability = p_double_spend_if_accepted_now(elapsed, confirmations, alpha)
            yield ProbabilityUpdate(
                confirmations=confirmations,
                probability=probability,
                elapsed_time=elapsed,
            )

            if confirmations >= 100 or probability <= 1e-12:
                return

            # Re-check status about every 10s (20 ticks * 0.5s).
            ticks += 1
            if ticks % 20 == 0:
                refreshed = await self.get_transaction(txid, alpha)
                if refreshed is not None:
                    confirmations = refreshed.confirmations
                    # Keep the first-seen clock stable while unconfirmed; adopt the
                    # real block time only once the transaction actually confirms.
                    if refreshed.blockhash != "":
                        confirmed = True
                        blocktime = refreshed.blocktime
            await asyncio.sleep(0.5)

    async def get_history(
        self, txid: str, alpha: float, lttb_threshold: int | None
    ) -> HistoryResponse | None:
        summary = await self.get_transaction(txid, alpha)
        if summary is None or summary.is_coinbase or summary.blockhash == "":
            return None  # unconfirmed transactions have no history curve yet

        # Model the per-confirmation decay from the real inclusion time instead of
        # fetching thousands of block timestamps (which would hit rate limits).
        max_confirmations = min(max(1, summary.confirmations), _HISTORY_MAX_CONFIRMATIONS)

        full_rows: list[tuple[float, float]] = []
        for confirmations in range(1, max_confirmations + 1):
            elapsed = (confirmations - 1) * _AVG_BLOCK_SECONDS
            probability = p_double_spend_if_accepted_now(elapsed, confirmations, alpha)
            full_rows.append((float(elapsed), float(probability)))

        limit = min(_FIVE_HOURS_SECONDS, int(full_rows[-1][0]))
        first_5h_rows: list[tuple[float, float]] = []
        for second in range(limit + 1):
            confirmations = min(1 + second // _AVG_BLOCK_SECONDS, max_confirmations)
            probability = p_double_spend_if_accepted_now(second, confirmations, alpha)
            first_5h_rows.append((float(second), float(probability)))

        return HistoryResponse(
            txid=txid,
            included_block_height=0,
            included_block_time=summary.blocktime,
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
