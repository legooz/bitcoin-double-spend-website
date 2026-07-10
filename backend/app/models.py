"""Pydantic models that define the API's JSON shapes.

These are the contract between the FastAPI backend and the React frontend.
FastAPI validates and serializes against them automatically, and the
matching TypeScript types on the frontend are hand-mirrored from these.
"""
from __future__ import annotations

from pydantic import BaseModel


class TransactionInput(BaseModel):
    address: str | None = None
    value: float | None = None


class TransactionOutput(BaseModel):
    value: float
    addresses: list[str | None] = []


class TransactionSummary(BaseModel):
    txid: str
    confirmations: int
    inputs: list[TransactionInput]
    outputs: list[TransactionOutput]
    blockhash: str
    time: int
    blocktime: int
    alpha: float
    probability: float
    is_coinbase: bool = False
    label: str | None = None


class ProbabilityUpdate(BaseModel):
    """A single live tick pushed over the WebSocket."""

    confirmations: int
    probability: float
    elapsed_time: float


class ProbabilityPoint(BaseModel):
    elapsed_seconds: float
    probability: float


class HistoryView(BaseModel):
    points: list[ProbabilityPoint]


class HistoryResponse(BaseModel):
    txid: str
    included_block_height: int
    included_block_time: int
    alpha: float
    full_graph: HistoryView
    first_5h: HistoryView


class SampleTransaction(BaseModel):
    txid: str
    label: str
