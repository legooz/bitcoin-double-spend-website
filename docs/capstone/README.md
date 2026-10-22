# Original Bitcoin Double-Spend capstone — Spring 2026

The original **Bitcoin Double-Spend Website** was developed as a **Spring 2026 capstone team project**.

This page documents the original application and its technical materials. The repository's current `backend/` and `frontend/` contain a later FastAPI/React rebuild; the capstone's .NET/Blazor components remain under `dscap-api/`, `dscap-web/`, and `dscap-py-worker/` for reference.

## Original source code

| Component | Original implementation |
| --- | --- |
| [Frontend](../../dscap-web/) | C# / .NET 8 Blazor with interactive server rendering and ApexCharts |
| [Middleware](../../dscap-api/) | ASP.NET Core API, typed transaction models, and SignalR |
| [Backend](../../dscap-py-worker/) | Python transaction processing, probability mathematics, FastAPI/WebSockets, and Bitcoin Core RPC/ZMQ |

All 96 tracked files from the recovered May 5, 2026 combined project snapshot are present in this repository. The C# source trees are preserved; the worker's RPC credentials were replaced with required environment variables in an earlier maintenance change. See the [source and setup guide](source-code.md) for provenance, dependencies, and the original service configuration.

## Poster and project artifacts

[![Final Bitcoin Double Spend Website capstone poster](poster/poster-preview.png)](poster/PosterFinal_cmyk.pdf)

| Artifact | Files | Publication notes |
| --- | --- | --- |
| Final poster | [Print PDF](poster/PosterFinal_cmyk.pdf) · [Editable PowerPoint](poster/Capstone-Poster-Editable.pptx) | Recovered final originals; preview above rendered from the PDF |
| Design and requirements | [Design document](reports/Bitcoin-Double-Spend-Design-Document.pdf) | Original February 4, 2026 document |
| Design presentation | [PowerPoint slides](presentations/DesignPres.pptx) | Recovered design presentation |
| Probability mathematics | [Equation reference](math/double_spend_equations.pdf) · [Equation notebook](math/capstone_equations.ipynb) | Original supporting work |
| Graph downsampling | [LTTB demonstration notebook](math/lttb_double_spend_demo.ipynb) | Original supporting experiment |

These are historical project artifacts. The final report and individual contribution record are excluded from the current public archive. The [source record](source-record.json) identifies the included files and their hashes.

## Verification

On October 21, 2026, both original .NET solutions built successfully with the installed .NET SDK. The API build had no warnings; the Blazor build retained one existing nullable-property warning (`CS8618` for `ApiBaseUrl`). All four worker configuration tests passed. This verifies compilation and configuration behavior; a full run against a synchronized Bitcoin Core node was not performed.

## Original goal

Combine transaction lookup with visual explanations of modeled double-spend risk. A user enters a Bitcoin transaction ID, reviews transaction details and confirmations, and explores historical and live probability curves under a chosen attacker hash-power assumption.

The capstone queried a Bitcoin Core node. Its Python processor normalized RPC data, calculated probability points, and exposed HTTP and WebSocket interfaces. ASP.NET Core middleware mapped the responses into typed models consumed by the Blazor interface.

```mermaid
flowchart LR
    User[Transaction lookup and parameter controls] --> Web[Blazor interface]
    Web --> API[ASP.NET Core middleware]
    API --> Worker[Python data and probability service]
    Worker --> Node[Bitcoin Core RPC]
    Node -->|Block notifications| Worker
    Worker -->|Historical and live probability data| API
    API -->|Typed responses| Web
```

The diagram summarizes the application's components and data flow.

## Engineering decisions

- **Separate responsibilities.** Node access, probability calculation, middleware models, and charts had distinct roles.
- **Preserve chart meaning.** Time-based curves and confirmation-step plots needed different axes and presentation.
- **Control graph size.** Long transaction histories required downsampling rather than emitting a point for every elapsed second.
- **Treat transaction categories explicitly.** Mempool, coinbase, old, and recently confirmed transactions exposed different missing fields and update behavior.

## Historical limitations

The original prototype depends on a synchronized Bitcoin Core node and that node's mempool. This describes the archived capstone application, rather than the later rebuilt application.

The probability depends on the model and attacker-share assumption. The project visualizes those assumptions; its output does not guarantee transaction finality.

## Source record

The included files and their SHA-256 hashes are recorded in [source-record.json](source-record.json). New explanatory prose and the architecture diagram on this page were added when organizing the archive.

The mathematical background comes from *Bitcoin: A Peer-to-Peer Electronic Cash System* (2008) and *An Analysis of Acceptance Policies for Blockchain Transactions* (2018). The probability model is based on that prior research.
