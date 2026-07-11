"""The data-source contract.

Any transaction data provider (demo simulator or real Bitcoin node) implements
this Protocol. Because the routes program against this interface, adding a new
provider never requires touching the API layer.
"""
from __future__ import annotations

from typing import AsyncIterator, Protocol, runtime_checkable

from app.models import (
    HistoryResponse,
    ProbabilityUpdate,
    SampleTransaction,
    TransactionSummary,
)


@runtime_checkable
class BitcoinSource(Protocol):
    async def get_transaction(self, txid: str, alpha: float) -> TransactionSummary | None:
        """Return a transaction summary, or None if it can't be found."""
        ...

    def stream_probability(
        self, txid: str, alpha: float
    ) -> AsyncIterator[ProbabilityUpdate]:
        """Yield live double-spend probability updates until the stream ends."""
        ...

    async def get_history(
        self, txid: str, alpha: float, lttb_threshold: int | None
    ) -> HistoryResponse | None:
        """Return the historical probability curve for a confirmed transaction."""
        ...

    def list_samples(self) -> list[SampleTransaction]:
        """Return clickable example transactions (empty for live sources)."""
        ...

    async def sample_mempool_txid(self) -> str | None:
        """Return a currently-unconfirmed txid to showcase, or None if unsupported."""
        ...

    async def largest_mining_pool(self) -> dict | None:
        """Return {"name", "share"} for the current largest mining pool, or None."""
        ...
