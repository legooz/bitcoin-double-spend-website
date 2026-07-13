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
import bisect
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
from app.probability.equations import double_spend_probability
from app.probability.lttb import choose_threshold, downsample

_SATS_PER_BTC = 100_000_000
_AVG_BLOCK_SECONDS = 600
_HISTORY_MAX_CONFIRMATIONS = 100
# How many post-inclusion block timestamps to pull when building the real
# confirmation timeline. 48 blocks (~4 API calls) covers the first 5 hours at
# any realistic pace, and enough of the tail for risk to reach zero.
_HISTORY_MAX_BLOCKS = 48
_FIVE_HOURS_SECONDS = 5 * 60 * 60
_POOL_TTL_SECONDS = 6 * 3600  # mining-pool shares drift slowly; cache for hours
_FIRST_5H_STEP_SECONDS = 5  # fine resolution through the decay region
_NEGLIGIBLE_PROBABILITY = 1e-6  # stop adding points once risk is this close to zero


class EsploraSource:
    def __init__(self, settings: Settings) -> None:
        self._base = settings.esplora_base_url.rstrip("/")
        self._client = httpx.AsyncClient(timeout=20.0)
        self._pool_cache: tuple[dict, float] | None = None

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

    async def largest_mining_pool(self) -> dict | None:
        # Cached for hours; pool shares change slowly and this hits an extra endpoint.
        now = time.time()
        if self._pool_cache and now - self._pool_cache[1] < _POOL_TTL_SECONDS:
            return self._pool_cache[0]
        try:
            data = await self._get_json("/v1/mining/pools/1w")
            pools = data["pools"]
            total = data.get("blockCount") or sum(p["blockCount"] for p in pools)
            top = max(pools, key=lambda p: p["blockCount"])
            result = {"name": top["name"], "share": top["blockCount"] / total}
            self._pool_cache = (result, now)
            return result
        except Exception:  # noqa: BLE001
            # Never hide the preset; fall back to a representative value.
            return self._pool_cache[0] if self._pool_cache else {"name": "the largest pool", "share": 0.25}

    async def sample_confirmed_txid(self) -> str | None:
        # First non-coinbase transaction in the tip block (recently confirmed).
        try:
            tip = await self._get_text("/blocks/tip/hash")
            txids = await self._get_json(f"/block/{tip}/txids")
            if txids and len(txids) > 1:
                return txids[1]  # index 0 is the coinbase
            return txids[0] if txids else None
        except Exception:  # noqa: BLE001
            return None

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

        # Coinbase transactions are included too: their "double-spend" risk is the
        # chance the block is orphaned and the reward reversed, which the same
        # equation captures (it is why coinbase outputs are locked for 100 blocks).
        probability = 0.0
        if blocktime > 0:
            elapsed = max(0.0, time.time() - blocktime)
            probability = double_spend_probability(elapsed, confirmations, alpha)

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
        if summary is None or summary.blocktime <= 0:
            return

        blocktime = summary.blocktime
        confirmations = summary.confirmations
        ticks = 0

        while True:
            elapsed = max(0.0, time.time() - blocktime)
            probability = double_spend_probability(elapsed, confirmations, alpha)
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
                    # Update the confirmation count but KEEP the original broadcast
                    # (first-seen) clock. The model's elapsed time is measured from
                    # broadcast; switching to the later block time here made elapsed
                    # jump backwards the moment the tx confirmed, and the frontend's
                    # monotonic-append guard then rejected every later update —
                    # freezing the live graph on the first confirmation.
                    confirmations = refreshed.confirmations
            await asyncio.sleep(0.5)

    async def _block_times(self, start_height: int, count: int) -> list[int]:
        """Ascending timestamps for blocks start_height .. start_height+count-1.

        Uses /v1/mining or, here, /v1/blocks/:height, which returns 15 blocks
        ending at :height — so a handful of calls covers the first few hours.
        Stops at whatever contiguous run starts at start_height.
        """
        by_height: dict[int, int] = {}
        end = start_height + count - 1
        h = end
        while h >= start_height:
            page = await self._get_json(f"/v1/blocks/{h}")
            if not page:
                break
            for block in page:
                height = block.get("height")
                if height is not None and start_height <= height <= end:
                    by_height[height] = int(block.get("timestamp", 0))
            lowest = min(block.get("height", h) for block in page)
            h = lowest - 1
        times: list[int] = []
        height = start_height
        while height in by_height:
            times.append(by_height[height])
            height += 1
        return times

    async def get_history(
        self, txid: str, alpha: float, lttb_threshold: int | None
    ) -> HistoryResponse | None:
        tx = await self._get_json(f"/tx/{txid}")
        if tx is None:
            return None
        status = tx.get("status", {})
        if not status.get("confirmed"):
            return None  # unconfirmed transactions have no history curve yet
        block_height = status.get("block_height")
        block_time = status.get("block_time")
        if block_height is None or not block_time:
            return None

        # Build the curve from the transaction's REAL confirmation timeline: the
        # timestamp of the block it landed in plus the blocks that followed. A
        # slowly-confirmed transaction (blocks hours apart) then genuinely shows
        # risk staying elevated, instead of the old uniform 10-minute model.
        tip = await self._tip_height()
        count = max(1, min(_HISTORY_MAX_BLOCKS, tip - block_height + 1))
        raw_times = await self._block_times(block_height, count)
        if not raw_times:
            return None
        # Bitcoin block timestamps can dip slightly (the 2-hour rule); force a
        # non-decreasing sequence so the confirmation count is well defined.
        block_times: list[int] = []
        running = raw_times[0]
        for stamp in raw_times:
            running = max(running, stamp)
            block_times.append(running)
        t0 = block_times[0]

        def confs_at(elapsed_seconds: int) -> int:
            # Number of blocks mined by t0 + elapsed (at least the inclusion block).
            return max(1, bisect.bisect_right(block_times, t0 + elapsed_seconds))

        # Full graph: one point per confirmation at its real elapsed time.
        full_rows: list[tuple[float, float]] = []
        for k in range(1, len(block_times) + 1):
            elapsed = float(block_times[k - 1] - t0)
            probability = double_spend_probability(elapsed, k, alpha)
            full_rows.append((elapsed, float(probability)))
            if probability <= _NEGLIGIBLE_PROBABILITY and k >= 2:
                break

        # First 5 hours: fine resolution with the REAL confirmation count at each
        # step, drawn only up to NOW — never into the future. For an old
        # transaction the whole 5 hours has elapsed, so this is the full window;
        # for a recent one it stops at the present, since we can't know future
        # confirmations (drawing them would show risk rising into time that
        # hasn't happened yet).
        limit = max(0, min(_FIVE_HOURS_SECONDS, int(time.time()) - t0))
        first_5h_rows: list[tuple[float, float]] = []
        for second in range(0, limit + 1, _FIRST_5H_STEP_SECONDS):
            confirmations = confs_at(second)
            probability = double_spend_probability(float(second), confirmations, alpha)
            first_5h_rows.append((float(second), float(probability)))

        return HistoryResponse(
            txid=txid,
            included_block_height=block_height,
            included_block_time=block_time,
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
