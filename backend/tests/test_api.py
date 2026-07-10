"""End-to-end tests against the demo data source using FastAPI's TestClient."""
from fastapi.testclient import TestClient

from app.main import app

_SAMPLE_TXID = "a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d"
_COINBASE_TXID = "9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f809abc"


def test_health():
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


def test_samples_are_listed():
    with TestClient(app) as client:
        response = client.get("/samples")
        assert response.status_code == 200
        assert len(response.json()) >= 1


def test_get_transaction_returns_summary():
    with TestClient(app) as client:
        response = client.get(f"/transaction/{_SAMPLE_TXID}", params={"alpha": 0.2})
        assert response.status_code == 200
        body = response.json()
        assert body["txid"] == _SAMPLE_TXID
        assert 0.0 <= body["probability"] <= 1.0


def test_invalid_txid_is_rejected():
    with TestClient(app) as client:
        response = client.get("/transaction/not-a-real-txid")
        assert response.status_code == 422


def test_unknown_txid_is_404():
    with TestClient(app) as client:
        response = client.get(f"/transaction/{'f' * 64}")
        assert response.status_code == 404


def test_history_for_sample_transaction():
    with TestClient(app) as client:
        response = client.get(f"/transaction/{_SAMPLE_TXID}/history", params={"alpha": 0.2})
        assert response.status_code == 200
        body = response.json()
        assert len(body["full_graph"]["points"]) > 0
        assert len(body["first_5h"]["points"]) > 0


def test_websocket_streams_updates():
    with TestClient(app) as client:
        with client.websocket_connect(f"/transaction/{_SAMPLE_TXID}/ws?alpha=0.2") as ws:
            first = ws.receive_json()
            assert "probability" in first
            assert "confirmations" in first
