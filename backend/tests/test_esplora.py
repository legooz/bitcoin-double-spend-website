"""Unit tests for the Esplora data source, with the HTTP layer mocked (respx).

These run offline and are safe for CI — they verify the parsing/normalization
of Esplora responses without hitting the real public API.
"""
import asyncio
import re

import respx

from app.config import Settings
from app.sources.esplora_source import EsploraSource

BASE = "https://mempool.space/api"


def _source() -> EsploraSource:
    return EsploraSource(Settings(data_source="esplora", esplora_base_url=BASE))


@respx.mock
def test_esplora_parses_confirmed_transaction():
    txid = "a" * 64
    respx.get(f"{BASE}/tx/{txid}").respond(
        json={
            "txid": txid,
            "status": {
                "confirmed": True,
                "block_height": 800000,
                "block_time": 1700000000,
                "block_hash": "0000hash",
            },
            "vin": [{"is_coinbase": False, "prevout": {"scriptpubkey_address": "bc1qsender", "value": 100000}}],
            "vout": [{"value": 90000, "scriptpubkey_address": "bc1qrecipient"}],
        }
    )
    respx.get(f"{BASE}/blocks/tip/height").respond(text="800002")

    summary = asyncio.run(_source().get_transaction(txid, 0.2))
    assert summary is not None
    assert summary.confirmations == 3  # tip 800002 - height 800000 + 1
    assert summary.blockhash == "0000hash"
    assert summary.inputs[0].address == "bc1qsender"
    assert summary.inputs[0].value == 0.001  # 100000 sats -> BTC
    assert summary.outputs[0].value == 0.0009
    assert not summary.is_coinbase
    assert 0.0 <= summary.probability <= 1.0


@respx.mock
def test_esplora_parses_unconfirmed_transaction():
    txid = "b" * 64
    respx.get(f"{BASE}/tx/{txid}").respond(
        json={
            "txid": txid,
            "status": {"confirmed": False},
            "vin": [{"is_coinbase": False, "prevout": {"scriptpubkey_address": "bc1qx", "value": 50000}}],
            "vout": [{"value": 49000, "scriptpubkey_address": "bc1qy"}],
        }
    )
    respx.get(url__regex=re.escape(f"{BASE}/v1/transaction-times") + r".*").respond(json=[1700000000])

    summary = asyncio.run(_source().get_transaction(txid, 0.2))
    assert summary is not None
    assert summary.confirmations == 0
    assert summary.blockhash == ""
    assert summary.blocktime == 1700000000  # anchored to first-seen time
    assert 0.0 <= summary.probability <= 1.0
