"""Live Bitcoin Core data source.

A faithful port of the original worker's RPC logic, behind the same interface as
the demo source. Requires a fully-synced Bitcoin Core node with ``txindex=1``
(needed to look up arbitrary transactions by id) and JSON-RPC enabled.

Notable change from the original: the live stream polls confirmation depth over
RPC instead of subscribing to ZMQ block notifications. This removes the ZMQ
dependency and the shared in-memory store, at the cost of a periodic RPC call.
"""
from __future__ import annotations

import asyncio
import math
from typing import AsyncIterator

import requests
from bitcoinrpc.authproxy import AuthServiceProxy
from requests.auth import HTTPBasicAuth

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
from app.probability.equations import double_spend_probability, p_double_spend_if_accepted_now
from app.probability.lttb import choose_threshold, downsample

_FIVE_HOURS_SECONDS = 5 * 60 * 60
_ZERO_PROB_THRESHOLD = math.exp(-300)
_ZERO_STREAK_REQUIRED = 500


class RpcSource:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def _rpc(self) -> AuthServiceProxy:
        # AuthServiceProxy is not thread-safe or reusable across calls, so we
        # build a fresh proxy per operation and run it off the event loop.
        return AuthServiceProxy(self._settings.rpc_url)

    def list_samples(self) -> list[SampleTransaction]:
        return []

    async def sample_mempool_txid(self) -> str | None:
        return None

    async def largest_mining_pool(self) -> dict | None:
        return None

    async def get_transaction(self, txid: str, alpha: float) -> TransactionSummary | None:
        return await asyncio.to_thread(self._get_transaction_sync, txid, alpha)

    def _get_transaction_sync(self, txid: str, alpha: float) -> TransactionSummary | None:
        rpc = self._rpc()
        try:
            tx = rpc.getrawtransaction(txid, True)
        except Exception as exc:  # noqa: BLE001 - RPC surfaces many error types
            print(f"RPC error fetching transaction {txid}: {exc}")
            return None

        is_coinbase = "coinbase" in tx["vin"][0]
        if is_coinbase:
            inputs = [TransactionInput(address="COINBASE", value=None)]
        else:
            inputs = _fetch_vin_addresses(tx, rpc)

        outputs = [
            TransactionOutput(
                value=vout.get("value", 0),
                addresses=vout["scriptPubKey"].get("addresses")
                or [vout["scriptPubKey"].get("address")],
            )
            for vout in tx.get("vout", [])
        ]

        confirmations = tx.get("confirmations", 0)
        blocktime = tx.get("blocktime", -1)
        time_seen = tx.get("time", -1)

        # Unconfirmed transaction: pull its first-seen time from the mempool.
        if blocktime == -1 and confirmations == 0:
            try:
                mempool = rpc.getrawmempool(True)
                if txid in mempool:
                    time_seen = mempool[txid]["time"]
                    blocktime = mempool[txid]["time"]
            except Exception as exc:  # noqa: BLE001
                print(f"Failed to fetch mempool: {exc}")

        probability = 0.0
        if not is_coinbase and blocktime > 0:
            elapsed = max(0.0, _now() - blocktime)
            probability = double_spend_probability(elapsed, confirmations, alpha)

        return TransactionSummary(
            txid=tx["txid"],
            confirmations=confirmations,
            inputs=inputs,
            outputs=outputs,
            blockhash=tx.get("blockhash", ""),
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
        ticks = 0

        while True:
            elapsed = max(0.0, _now() - blocktime)
            probability = double_spend_probability(elapsed, confirmations, alpha)
            yield ProbabilityUpdate(
                confirmations=confirmations,
                probability=probability,
                elapsed_time=elapsed,
            )

            if confirmations >= 100 or probability <= _ZERO_PROB_THRESHOLD:
                return

            # Re-check confirmation depth roughly every 20s (40 ticks * 0.5s).
            ticks += 1
            if ticks % 40 == 0:
                refreshed = await self.get_transaction(txid, alpha)
                if refreshed is not None:
                    confirmations = refreshed.confirmations
            await asyncio.sleep(0.5)

    async def get_history(
        self, txid: str, alpha: float, lttb_threshold: int | None
    ) -> HistoryResponse | None:
        return await asyncio.to_thread(self._get_history_sync, txid, alpha, lttb_threshold)

    def _get_history_sync(
        self, txid: str, alpha: float, lttb_threshold: int | None, batch_size: int = 500
    ) -> HistoryResponse | None:
        rpc = self._rpc()
        try:
            tx = rpc.getrawtransaction(txid, True)
        except Exception as exc:  # noqa: BLE001
            print(f"RPC error fetching transaction {txid}: {exc}")
            return None

        blockhash = tx.get("blockhash")
        if not blockhash:
            return None  # not confirmed yet, no history to build

        inclusion_block = rpc.getblockheader(blockhash)
        start_height = inclusion_block["height"]
        start_time = inclusion_block["time"]
        tip_height = rpc.getblockcount()

        confirmation_rows: list[list[float]] = []
        full_rows: list[tuple[float, float]] = []
        zero_streak = 0
        stopped_early = False

        for chunk_start in range(start_height, tip_height + 1, batch_size):
            chunk_end = min(chunk_start + batch_size - 1, tip_height)
            heights = list(range(chunk_start, chunk_end + 1))

            blockhashes = _rpc_batch(
                self._settings,
                [
                    {"jsonrpc": "1.0", "id": i, "method": "getblockhash", "params": [h]}
                    for i, h in enumerate(heights)
                ],
            )
            headers = _rpc_batch(
                self._settings,
                [
                    {"jsonrpc": "1.0", "id": i, "method": "getblockheader", "params": [bh]}
                    for i, bh in enumerate(blockhashes)
                ],
            )

            for header in headers:
                height = header["height"]
                block_time = header["time"]
                elapsed = block_time - start_time
                confirmations = height - start_height + 1
                probability = float(p_double_spend_if_accepted_now(elapsed, confirmations, alpha))

                confirmation_rows.append([elapsed, confirmations])
                full_rows.append((float(elapsed), probability))

                zero_streak = zero_streak + 1 if probability <= _ZERO_PROB_THRESHOLD else 0
                if elapsed >= _FIVE_HOURS_SECONDS and zero_streak >= _ZERO_STREAK_REQUIRED:
                    stopped_early = True
                    break
            if stopped_early:
                break

        first_5h_rows = _build_first_5h_rows(confirmation_rows, alpha)

        return HistoryResponse(
            txid=txid,
            included_block_height=start_height,
            included_block_time=start_time,
            alpha=alpha,
            full_graph=_to_view(full_rows, lttb_threshold),
            first_5h=_to_view(first_5h_rows, lttb_threshold),
        )


def _now() -> float:
    import time

    return time.time()


def _rpc_batch(settings: Settings, payloads: list[dict]) -> list:
    response = requests.post(
        settings.rpc_url,
        auth=HTTPBasicAuth(settings.rpc_user, settings.rpc_password),
        json=payloads,
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, list):
        raise ValueError(f"Expected batch response list, got: {data}")
    data.sort(key=lambda item: item["id"])
    for item in data:
        if item.get("error") is not None:
            raise ValueError(item["error"])
    return [item["result"] for item in data]


def _build_first_5h_rows(confirmation_rows: list[list[float]], alpha: float) -> list[tuple[float, float]]:
    if not confirmation_rows:
        return []
    limit = min(_FIVE_HOURS_SECONDS, int(confirmation_rows[-1][0]))
    rows: list[tuple[float, float]] = []
    index = 0
    for second in range(limit + 1):
        while index + 1 < len(confirmation_rows) and confirmation_rows[index + 1][0] <= second:
            index += 1
        confirmations = int(confirmation_rows[index][1])
        probability = float(p_double_spend_if_accepted_now(second, confirmations, alpha))
        rows.append((float(second), probability))
    return rows


def _fetch_vin_addresses(tx: dict, rpc: AuthServiceProxy) -> list[TransactionInput]:
    inputs: list[TransactionInput] = []
    for vin in tx.get("vin", []):
        if "txid" not in vin:
            continue
        try:
            source = rpc.getrawtransaction(vin["txid"], True)
            for output in source.get("vout", []):
                if output["n"] == vin["vout"]:
                    spk = output.get("scriptPubKey", {})
                    address = spk.get("address") or (spk.get("addresses") or [None])[0]
                    if address:
                        inputs.append(TransactionInput(address=address, value=float(output.get("value"))))
                    break
        except Exception as exc:  # noqa: BLE001
            print(f"Failed to fetch vin {vin.get('txid')}: {exc}")
    return inputs


def _to_view(rows: list[tuple[float, float]], lttb_threshold: int | None) -> HistoryView:
    threshold = choose_threshold(len(rows), lttb_threshold)
    sampled = downsample(rows, threshold)
    return HistoryView(
        points=[ProbabilityPoint(elapsed_seconds=x, probability=y) for x, y in sampled]
    )
