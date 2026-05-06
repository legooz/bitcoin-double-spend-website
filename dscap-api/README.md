# DSCap API

DSCap API is the backend API layer for the Double Spend Capstone project. It connects the front-end web application to the Python Bitcoin data processor and provides transaction data, probability calculations, and live updates.

## Project Purpose

The purpose of DSCap API is to act as middleware between the DSCap Web front end and the Python data processor. This keeps the front end separate from the lower-level Bitcoin RPC and Python processing logic.

## Main Features

- Receive transaction search requests from the web app
- Return Bitcoin transaction summary data
- Communicate with the Python backend service
- Provide live probability data through WebSocket connections
- Convert backend JSON responses into C# models
- Help separate front-end display logic from backend processing logic

## Technology Stack

- C#
- .NET Core / ASP.NET Core
- HTTP API endpoints
- WebSocket support
- DTO models for transaction data
- Python backend integration

## Project Structure

```text
DSCapService/
├── DSCapService.sln
│
├── DSCapService/
│   ├── Controllers/
│   │   └── TXController.cs
│   ├── Properties/
│   │   └── launchSettings.json
│   ├── Program.cs
│   ├── appsettings.json
│   ├── appsettings.Development.json
│   ├── DSCapService.csproj
│   └── DSCapService.http
│
├── DSCapService.Core/
│   ├── Contracts/
│   │   ├── RepositoryContracts/
│   │   │   └── ITXRepository.cs
│   │   └── ServiceContracts/
│   │       ├── ITransactionBroadcastService.cs
│   │       └── ITXService.cs
│   ├── Helpers/
│   │   └── TransactionSubscriptionHelper.cs
│   ├── Models/
│   │   └── DTOs/
│   │       ├── BtcInputDTO.cs
│   │       ├── BtcOutputDTO.cs
│   │       ├── BtcTransactionDTO.cs
│   │       ├── BtcTransactionLiveUpdateDTO.cs
│   │       ├── StartLiveUpdatesRequestDTO.cs
│   │       ├── TransactionHistoryRawDTO.cs
│   │       ├── TransactionHistoryResponseDTO.cs
│   │       └── TransactionUpdateProbeDTO.cs
│   ├── Options/
│   │   └── BTCNodeAddress.cs
│   ├── Services/
│   │   └── TXService.cs
│   ├── ServiceDefinitionExtensions.cs
│   └── DSCapService.Core.csproj
│
├── DSCapService.Infrastructure/
│   ├── Repositories/
│   │   └── TXRepository.cs
│   ├── ServiceDefinitionExtensions.cs
│   └── DSCapService.Infrastructure.csproj
│
└── DSCapService.Realtime/
    ├── Hubs/
    │   └── TransactionHub.cs
    ├── Services/
    │   └── TransactionBroadcastService.cs
    ├── ServiceDefinitionExtensions.cs
    └── DSCapService.Realtime.csprojapAPI.sln
```

## Solution Layout

The `DSCapService` solution is separated into four projects within the VS solution:

- `DSCapService` is the ASP.NET Core API entry point. It contains the controllers, application startup code, Swagger setup, CORS setup, and SignalR hub mapping.

- `DSCapService.Core` contains the shared contracts, DTOs, options, helpers, and core transaction service logic. This project defines the main application logic and the interfaces used by the other layers.

- `DSCapService.Infrastructure` contains the repository implementation used to communicate with the external Python Bitcoin data processor. It also configures the named `PythonClient` HTTP client.

- `DSCapService.Realtime` contains the SignalR real-time update layer. It defines the transaction hub and the broadcast service used to stream live transaction probability updates.

The main API project references `Core`, `Infrastructure`, and `Realtime`. `Infrastructure` and `Realtime` both depend on `Core`.

## Running the Project

Make sure the Python backend service is running first.

Then run the API project using Visual Studio IIS Express debug mode for develpment.