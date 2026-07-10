# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the **Double Spend Capstone (DSCap)** project: a web app that estimates the probability a Bitcoin transaction could be **double-spent** (reversed by an attacker mining a competing chain) and streams that probability live as the transaction ages and confirms. Double-spend risk matters most in the early, low-confirmation stage, so **mempool (unconfirmed) transactions are a first-class feature**.

The app was rebuilt from an earlier .NET stack. The current stack is:

```
React + TypeScript (Vite)      FastAPI (Python)              Probability engine + data source
┌──────────────────────┐  HTTP/WS  ┌──────────────────┐  interface  ┌───────────────────────┐
│ frontend/  (SPA)      │ ────────▶ │ backend/ (API)    │ ──────────▶ │ demo | esplora | rpc  │
│ Recharts, live stream │           │ REST + WebSocket  │             │                       │
└──────────────────────┘           └──────────────────┘             └───────────────────────┘
```

The old `.NET`/Python-worker projects (`dscap-api/`, `dscap-web/`, `dscap-py-worker/`) are kept in the repo **for reference only** and are no longer the active app. New work goes in `backend/` and `frontend/`.

## The data-source abstraction (most important concept)

The backend depends only on the `BitcoinSource` interface (`backend/app/sources/base.py`). The concrete implementation is chosen at startup from the `DSCAP_DATA_SOURCE` env var, so the API and frontend never change when the data origin changes:

- **`demo`** (default) — `backend/app/sources/demo_source.py`. Self-contained simulator using a JSON fixture (`backend/fixtures/demo_transactions.json`). No node, no network, safe to deploy publicly. Simulates a fresh transaction confirming over time so the live decay always plays.
- **`esplora`** — `backend/app/sources/esplora_source.py`. Real mainnet data via the public Esplora REST API (mempool.space / blockstream.info). No API key, no node. Supports mempool/unconfirmed transactions and a live-mempool sample loader. Confirmation depth is polled (not ZMQ).
- **`rpc`** — `backend/app/sources/rpc_source.py`. A self-hosted, fully-synced Bitcoin Core node (`txindex=1`, JSON-RPC). Ported from the original worker; kept for completeness.

When adding a data provider, implement the four `BitcoinSource` methods and register it in `backend/app/sources/__init__.py:build_source`. Do not add provider-specific logic to the routes.

The **probability math is the crown jewel** and is provider-independent: `backend/app/probability/equations.py` (log-space double-spend probability, requires `0 < alpha < 0.5`) and `lttb.py` (graph downsampling). A correct-but-surprising property: with confirmations held fixed, risk *rises* with elapsed time; in practice confirmations arrive faster than that, so the live curve trends down.

## Commands

### Backend (FastAPI, Python 3.12)
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt          # runtime + pytest
cp .env.example .env                          # defaults to demo mode
uvicorn app.main:app --reload                 # http://localhost:8000
pytest -q                                     # run all tests
pytest tests/test_equations.py -q             # run one test file
```

### Frontend (React + TypeScript, Vite, Node 22)
```bash
cd frontend
npm install
cp .env.example .env                          # VITE_API_BASE_URL=http://localhost:8000
npm run dev                                   # http://localhost:5173
npm run build                                 # tsc type-check + production bundle
```

### Full stack via Docker
```bash
docker compose up --build                     # frontend :8080, api :8000
```

## Configuration (env-driven; never hard-code)

Backend vars are prefixed `DSCAP_` (see `backend/app/config.py` / `backend/.env.example`):
- `DSCAP_DATA_SOURCE` — `demo` | `esplora` | `rpc`
- `DSCAP_CORS_ORIGINS` — comma-separated allowed frontend origins (default allows both `localhost:5173` and `127.0.0.1:5173`)
- `DSCAP_RPC_*` — only for `rpc` mode
- `DSCAP_ESPLORA_BASE_URL` — Esplora API base for `esplora` mode

Frontend: `VITE_API_BASE_URL` (baked in at build time). `localhost` and `127.0.0.1` are **different CORS origins** — a mismatch silently blocks `/samples` and other fetches, so keep them aligned.

## API surface

`backend/app/routes/transactions.py`: `GET /health`, `GET /samples`, `GET /mempool/sample` (esplora only), `GET /transaction/{txid}`, `GET /transaction/{txid}/history`, and the WebSocket `GET /transaction/{txid}/ws?alpha=`. TypeScript mirrors of the response models live in `frontend/src/types.ts` and must stay in sync with `backend/app/models.py`.

## Conventions and gotchas

- `alpha` (attacker hash-power share) threads through every layer and is clamped to `(0.01, 0.49)` in the routes; the equation is undefined outside `(0, 0.5)`.
- State is in-memory and per-connection; there is no database.
- `esplora` tests are intentionally **excluded from CI** (they depend on an external service). The CI suite (`.github/workflows/ci.yml`) covers the probability math, demo-mode API, and the frontend build. Verify `esplora` manually against the live API.
- Unconfirmed transactions are ephemeral, so the mempool sample loader fetches a fresh one each time rather than pinning one.
