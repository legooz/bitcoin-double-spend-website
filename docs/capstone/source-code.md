# Original .NET / Blazor capstone source

The original Spring 2026 capstone application is preserved in these three directories:

| Component | Source | Role |
| --- | --- | --- |
| C# Blazor frontend | [`dscap-web/`](../../dscap-web/) | Transaction search, details, historical charts, and live probability display |
| C# ASP.NET Core middleware | [`dscap-api/`](../../dscap-api/) | HTTP endpoints, typed transaction models, and SignalR updates between the UI and Python worker |
| Python backend worker | [`dscap-py-worker/`](../../dscap-py-worker/) | Bitcoin Core RPC access, probability calculations, history downsampling, and HTTP/WebSocket responses |

These directories contain the original application. The repository's `frontend/` and `backend/` directories contain the later React/FastAPI rebuild. See the [capstone history and team record](README.md) for the original team and project context.

## Recovery and provenance

The local combined repository snapshot at commit [`3813959`](https://github.com/legooz/bitcoin-double-spend-website/commit/3813959), dated May 5, 2026, was compared with the current repository during recovery on October 21, 2026. All **96 tracked files** from that snapshot are present. After normalizing Windows and Unix line endings, only the Python worker's `README.md` and `RPC_Params.py` differ: existing repository changes document and implement environment-based credentials in place of the original embedded configuration. The original application source logic remains preserved.

Two additional local copies, `capstone-final` and `SourceTreeProjects`, independently corroborated the recovered source. Their source content matched each other. Relative to the combined GitHub snapshot, the differences were a worker ignore file, the combined repository's license, and a trailing newline in `transaction_probability.py`.

The separate original component repositories ended at these commits:

| Component | Original commit | Commit date |
| --- | --- | --- |
| `dscap-web` | `2a5f84a` | April 30, 2026 |
| `dscap-api` | `abf640b` | April 30, 2026 |
| `dscap-py-worker` | `a2a6918` | April 30, 2026 |

The current safe worker configuration is retained. Local credential-bearing files and generated Visual Studio, build, and Python cache files are not needed to recover the source.

## Architecture and dependencies

All seven C# projects target **.NET 8**. The frontend uses **Blazor interactive server rendering**, as configured in its [`Program.cs`](../../dscap-web/src/DSCapWeb/DSCapWeb/Program.cs), and **Blazor-ApexCharts 6.1.0**. The middleware uses ASP.NET Core controllers and a SignalR hub at `/hubs/transactions`.

The Python worker uses **FastAPI**, **Uvicorn**, **python-bitcoinrpc**, **pyzmq**, **SciPy**, and **Requests**. Its optional `dummy_client.py` also imports **websockets**. The source uses Python 3.10+ type annotation syntax. This dependency list is inferred from the preserved imports; the original worker did not provide a pinned dependency manifest or lockfile.

The worker reads Bitcoin Core transaction data over RPC and listens for ZMQ `hashblock` notifications. It exposes transaction lookup, probability history, and live probability updates. The middleware forwards these to the Blazor application.

## Build reference

From the repository root with the .NET 8 SDK installed:

```powershell
dotnet build dscap-api/src/DSCapService/DSCapService.sln
dotnet build dscap-web/src/DSCapWeb/DSCapWeb.sln
```

The original component guides are also preserved: [frontend](../../dscap-web/README.md), [middleware](../../dscap-api/README.md), and [Python worker](../../dscap-py-worker/README.md).

## Run reference

The original application needs a configured Bitcoin Core node. This sequence is derived from the preserved code and launch settings; it is not a claim that a live node-backed session was validated during recovery.

### 1. Bitcoin Core and Python worker

The current worker configuration expects Bitcoin Core RPC on `127.0.0.1:8332` and ZMQ block notifications on `127.0.0.1:28332`. Configure the node to serve the transactions you intend to query and publish `hashblock` notifications to that ZMQ endpoint.

Create an isolated Python environment from the repository root, then install the inferred dependencies:

```powershell
python -m venv dscap-py-worker/.venv
dscap-py-worker/.venv/Scripts/python.exe -m pip install fastapi uvicorn python-bitcoinrpc pyzmq scipy requests websockets
```

These packages are unpinned because no original version record was recovered. Installing their current versions does not establish historical compatibility.

Set `DSCAP_RPC_USER` and `DSCAP_RPC_PASSWORD` in the worker process environment using your node's credentials. Neither variable has a default, and the worker does not automatically load an `.env` file. Follow the [worker configuration instructions](../../dscap-py-worker/README.md), then start it:

```powershell
cd dscap-py-worker
.venv/Scripts/python.exe routes.py
```

The original entry point listens on port `8000`. The middleware's committed configuration points to this worker over HTTP and WebSocket on loopback.

### 2. ASP.NET Core middleware

The original Visual Studio workflow opens [`DSCapService.sln`](../../dscap-api/src/DSCapService/DSCapService.sln) and launches the main `DSCapService` project with **IIS Express**. Its configured HTTPS address is `https://localhost:44375`.

For a CLI alternative, use a terminal at the repository root and explicitly preserve that port:

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet run --project dscap-api/src/DSCapService/DSCapService/DSCapService.csproj --no-launch-profile -- --urls https://localhost:44375
```

### 3. Blazor frontend

Open [`DSCapWeb.sln`](../../dscap-web/src/DSCapWeb/DSCapWeb.sln) and launch the main `DSCapWeb` project with **IIS Express**. Its configured HTTPS address is `https://localhost:44369`.

For the CLI alternative, use a separate terminal at the repository root:

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet run --project dscap-web/src/DSCapWeb/DSCapWeb/DSCapWeb.csproj --no-launch-profile -- --urls https://localhost:44369
```

Open `https://localhost:44369` after the worker and middleware are running. The CLI HTTPS commands require an available ASP.NET Core development certificate; on a development machine it can be set up with `dotnet dev-certs https --trust`.

The explicit ports matter: the frontend's `DSCapWebSettings:ApiBaseUrl` points to `https://localhost:44375/`, and the middleware's CORS configuration includes `https://localhost:44369`. The default non-IIS launch profiles use different ports. If changing the addresses, update the corresponding configuration together.

## Configuration check

The repository includes tests for the worker's environment-based credential handling. They can be run without a Bitcoin node or the worker's third-party packages:

```powershell
python -m unittest discover -s dscap-py-worker/tests -v
```

This checks configuration behavior; a complete live transaction workflow additionally requires the node, worker, middleware, and frontend to run together.
