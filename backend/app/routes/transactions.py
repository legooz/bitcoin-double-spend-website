"""HTTP + WebSocket endpoints for transaction data.

Routes depend only on the ``BitcoinSource`` interface (resolved at startup and
stored on ``app.state``), so they are identical whether the data comes from the
demo simulator or a real node.
"""
from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException, Query, Request, WebSocket, WebSocketDisconnect

from app.models import HistoryResponse, SampleTransaction, TransactionSummary
from app.sources.base import BitcoinSource

router = APIRouter()

_TXID_RE = re.compile(r"^[0-9a-fA-F]{64}$")


def _source(request: Request) -> BitcoinSource:
    return request.app.state.source


def _validate_txid(txid: str) -> str:
    if not _TXID_RE.match(txid):
        raise HTTPException(status_code=422, detail="Invalid transaction id (expected 64 hex characters).")
    return txid.lower()


def _clamp_alpha(alpha: float) -> float:
    # The probability model is only defined for 0 < alpha < 0.5.
    return min(max(alpha, 0.01), 0.49)


@router.get("/samples", response_model=list[SampleTransaction])
async def list_samples(request: Request) -> list[SampleTransaction]:
    return _source(request).list_samples()


@router.get("/mempool/sample")
async def mempool_sample(request: Request) -> dict[str, str]:
    txid = await _source(request).sample_mempool_txid()
    if not txid:
        raise HTTPException(status_code=404, detail="No live mempool sample available in this mode.")
    return {"txid": txid}


@router.get("/transaction/{txid}", response_model=TransactionSummary)
async def get_transaction(
    txid: str,
    request: Request,
    alpha: float = Query(0.15, ge=0.0, le=0.5),
) -> TransactionSummary:
    txid = _validate_txid(txid)
    summary = await _source(request).get_transaction(txid, _clamp_alpha(alpha))
    if summary is None:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    return summary


@router.get("/transaction/{txid}/history", response_model=HistoryResponse)
async def get_history(
    txid: str,
    request: Request,
    alpha: float = Query(0.15, ge=0.0, le=0.5),
    lttb_threshold: int | None = Query(None, gt=0),
) -> HistoryResponse:
    txid = _validate_txid(txid)
    history = await _source(request).get_history(txid, _clamp_alpha(alpha), lttb_threshold)
    if history is None:
        raise HTTPException(status_code=404, detail="No probability history available for this transaction.")
    return history


@router.websocket("/transaction/{txid}/ws")
async def probability_ws(websocket: WebSocket, txid: str, alpha: float = 0.15) -> None:
    await websocket.accept()
    if not _TXID_RE.match(txid):
        await websocket.close(code=1008)
        return

    source: BitcoinSource = websocket.app.state.source
    try:
        async for update in source.stream_probability(txid.lower(), _clamp_alpha(alpha)):
            await websocket.send_json(update.model_dump())
        await websocket.close()
    except WebSocketDisconnect:
        # Client navigated away; nothing to clean up thanks to per-connection state.
        pass
