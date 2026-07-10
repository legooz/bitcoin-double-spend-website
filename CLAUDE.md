# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the **Double Spend Capstone (DSCap)** project: a three-tier system that estimates the probability that a given Bitcoin transaction could be double-spent, and streams that probability to a web UI in real time. A request flows:

```
Browser ──> dscap-web (Blazor Server) ──HTTP/SignalR──> dscap-api (ASP.NET Core) ──HTTP/WebSocket──> dscap-py-worker (FastAPI) ──RPC/ZMQ──> Bitcoin Core node
```

The three tiers live in sibling directories and are deployed/run independently. Start them **bottom-up**: Bitcoin Core node → `dscap-py-worker` → `dscap-api` → `dscap-web`. Each downstream tier assumes the one below it is already up.

## The three tiers

### `dscap-py-worker/` — Python FastAPI worker (the only tier that talks to Bitcoin Core)
- Fetches raw transactions via Bitcoin Core JSON-RPC, summarizes them, and computes double-spend probability.
- Listens on **ZMQ** (`hashblock` topic) for newly mined blocks; on each block it increments `confirmations` for every transaction in the in-memory store.
- Endpoints (`routes.py`): `GET /transaction`, `GET /transaction/probability-history`, and the WebSocket `ws://.../probability/{txid}/{alpha}` which pushes a probability update ~2×/sec (throttled to every 10s after 50 confirmations, closes at 100).
- Runs on `0.0.0.0:8000` via Uvicorn.

### `dscap-api/` — ASP.NET Core Web API (middleware; **no** Bitcoin/RPC knowledge)
- Solution `DSCapService.sln`. Bridges the web front end and the Python worker so the front end never touches Bitcoin RPC directly.
- Calls the Python worker over the named `PythonClient` HttpClient / `ClientWebSocket`, maps its JSON into C# DTOs, and re-broadcasts live updates to browsers over **SignalR**.
- REST endpoints on `TXController` (`/transaction/...`): `{id}`, `{id}/history`, `{id}/live-update`, `{id}/live/start`. SignalR hub mapped at `/hubs/transactions`.

### `dscap-web/` — Blazor Server front end
- Solution `DSCapWeb.sln`. Razor components under `Components/Pages` (search, transaction summary, probability graphs). Uses **ApexCharts** for graphs and Bootstrap for styling.
- Calls the API over the named `ApiClient` HttpClient and subscribes to the API's SignalR hub via `TransactionHubClient`.

## Layered project convention (applies to both .NET solutions)

Both solutions follow the same Clean-Architecture-style split. When adding functionality, place it in the matching layer and wire it through the existing interfaces — do not shortcut across layers.

- **`.Core`** — contracts (interfaces under `Contracts/ServiceContracts` and `Contracts/RepositoryContracts`), DTOs, `Options`, `Helpers`, and the service logic. Defines interfaces the other layers implement.
- **`.Infrastructure`** — repository implementations that make the outbound HTTP/WebSocket calls, plus named HttpClient registration.
- **`.Realtime`** (API only) — SignalR `TransactionHub` and `TransactionBroadcastService`.
- The startup project (`DSCapService` / `DSCapWeb`) references the others; `.Infrastructure` and `.Realtime` depend on `.Core`.
- Each layer registers its own services through a static `ServiceDefinitionExtensions.Add*(services, configuration)` method called from `Program.cs`. Register new services there, not inline in `Program.cs`.

## Cross-cutting conventions (important, easy to break)

- **`alpha`** is the attacker hashpower fraction and threads through all three tiers. It **must be formatted as a 2-decimal invariant-culture string** (`"F2"`, `MidpointRounding.AwayFromZero`) on every hop — see `TransactionSubscriptionHelper` in the API and `TXSummaryRepository` in the web tier. The probability equation requires `0 < alpha < 0.5`.
- **SignalR group key** is derived from `txid + alpha` (`TransactionSubscriptionHelper.BuildGroupKey`). The broadcast side and the subscribe side must build the key identically or updates won't be delivered. The client listens for the `"ReceiveTransactionUpdate"` message and calls `"SubscribeToTransaction"` / `"UnsubscribeFromTransaction"`.
- The Python worker keeps transaction state **in memory** (`state.py`: `TRANSACTION_STORE`, `CLIENT_TRACKER`, guarded by `STORE_LOCK`/`CLIENT_LOCK`). Entries are reference-counted per connected client and cleaned up on a delayed task after the last client disconnects. There is no database in any tier.

## Running & building

There is no unified build script, no test suite, and no linter configured in this repo. Each tier is built/run on its own.

### Python worker
No `requirements.txt` exists — dependencies must be installed manually: `fastapi`, `uvicorn`, `pyzmq`, `python-bitcoinrpc`, `scipy`.
```bash
cd dscap-py-worker
python routes.py            # serves on 0.0.0.0:8000 (or: uvicorn routes:app --host 0.0.0.0 --port 8000)
```
Requires a running Bitcoin Core node with RPC + ZMQ enabled. Connection settings live in `RPC_Params.py`.

### .NET API and Web
Requires the **.NET 8 SDK**. The READMEs describe running via Visual Studio IIS Express, but the CLI equivalents are:
```bash
cd dscap-api/src/DSCapService/DSCapService  &&  dotnet run    # API
cd dscap-web/src/DSCapWeb/DSCapWeb          &&  dotnet run    # Web
# build only:  dotnet build ../../DSCapService.sln
```
Default dev ports (`launchSettings.json` / `appsettings.json`):
- Web (HTTPS IIS Express): `https://localhost:44369` — this exact origin is hard-coded in the API's CORS `BlazorClient` policy.
- API (HTTPS IIS Express): `https://localhost:44375` — this is the web tier's `DSCapWebSettings:ApiBaseUrl`.
- Python worker: `http://127.0.0.1:8000` — the API's `BTCNode:BaseAddress` / `WebSocketBaseAddress`.

If you change a port, update the matching value in the consuming tier (and the CORS origin) or the tiers won't connect.

## Security note

`dscap-py-worker/RPC_Params.py` currently contains **hard-coded Bitcoin RPC credentials** committed to the repo. Treat these as development-only; do not add real/production credentials here, and flag this if hardening for deployment.
