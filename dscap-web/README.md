# DSCap Web

DSCap Web is the front-end web application for the Double Spend Capstone project. It provides a user interface for searching Bitcoin transactions, viewing transaction details, and displaying double-spend probability graphs over time and confirmations.

## Project Purpose

The goal of DSCap Web is to make Bitcoin transaction risk data easier to understand. Users can enter a Bitcoin transaction ID and view a summary of the transaction along with live probability updates from the backend API.

## Main Features

- Search for Bitcoin transactions by transaction ID
- Display transaction summary information
- Show transaction inputs and outputs
- Display confirmation count and block information
- Show double-spend probability over time
- Show probability changes by confirmation count
- Communicate with the backend API using HTTP and WebSocket connections

## Technology Stack

- Blazor WebAssembly or Blazor Web App
- C#
- .NET
- ApexCharts for graph display
- CSS for custom page styling

## Project Structure
```text
DSCapWeb/
├── DSCapWeb.sln
│
├── DSCapWeb/
│   ├── Components/
│   │   ├── Layout/
│   │   │   ├── MainLayout.razor
│   │   │   ├── MainLayout.razor.css
│   │   │   ├── NavMenu.razor
│   │   │   └── NavMenu.razor.css
│   │   ├── Pages/
│   │   │   ├── CompareProbabilityGraph.razor
│   │   │   ├── Error.razor
│   │   │   ├── Home.razor
│   │   │   ├── Home.razor.css
│   │   │   ├── LiveProbabilityGraph.razor
│   │   │   ├── ProbabilityGraph.razor
│   │   │   ├── SearchResults.razor
│   │   │   ├── SearchResults.razor.cs
│   │   │   ├── SearchResults.razor.css
│   │   │   └── TransactionLiveStats.razor
│   │   ├── App.razor
│   │   ├── Routes.razor
│   │   └── _Imports.razor
│   ├── Properties/
│   │   └── launchSettings.json
│   ├── wwwroot/
│   │   ├── bootstrap/
│   │   │   ├── bootstrap.min.css
│   │   │   └── bootstrap.min.css.map
│   │   ├── app.css
│   │   ├── bitcoin-logo.png
│   │   └── favicon.png
│   ├── Program.cs
│   ├── appsettings.json
│   ├── appsettings.Development.json
│   └── DSCapWeb.csproj
│
├── DSCapWeb.Core/
│   ├── Contracts/
│   │   ├── RepositoryContracts/
│   │   │   ├── ITXHistoryRepository.cs
│   │   │   └── ITXSummaryRepository.cs
│   │   └── ServiceContracts/
│   │       ├── ITXHistoryService.cs
│   │       ├── ITXLiveUpdateService.cs
│   │       └── ITXSummaryService.cs
│   ├── Helpers/
│   ├── Models/
│   │   ├── BtcInputDTO.cs
│   │   ├── BtcOutputDTO.cs
│   │   ├── BtcTransactionDTO.cs
│   │   ├── BtcTransactionLiveUpdateDTO.cs
│   │   ├── StartLiveUpdatesRequestDTO.cs
│   │   └── TransactionHistoryResponseDTO.cs
│   ├── Options/
│   │   └── DSCapWebSettings.cs
│   ├── Services/
│   │   ├── TransactionHubClient.cs
│   │   ├── TXHistoryService.cs
│   │   └── TXSummaryService.cs
│   ├── ServiceDefinitionExtensions.cs
│   └── DSCapWeb.Core.csproj
│
└── DSCapWeb.Infrastructure/
    ├── Repositories/
    │   ├── TXHistoryRepository.cs
    │   └── TXSummaryRepository.cs
    ├── Services/
    │   └── TXLiveUpdateService.cs
    ├── ServiceDefinitionExtensions.cs
    └── DSCapWeb.Infrastructure.csproj
```

## Solution Layout

The `DSCapWeb` solution is separated into three projects within the VS solution:

- `DSCapWeb` is the Blazor Server user interface. It contains the Razor components, pages, layout, styling, static assets, application startup code, and graph components.

- `DSCapWeb.Core` contains the shared contracts, DTO models, configuration options, and core web-facing services. It also contains `TransactionHubClient`, which handles the SignalR client connection logic used for live transaction updates.

- `DSCapWeb.Infrastructure` contains repository implementations for calling the API and the live update service implementation. It configures the named `ApiClient` HTTP client using the `DSCapWebSettings:ApiBaseUrl` value from configuration.

The main web project references `Core` and `Infrastructure`. `Infrastructure` depends on `Core`. There is currently no separate `DSCapWeb.Realtime` project; real-time client logic is split between `DSCapWeb.Core` and `DSCapWeb.Infrastructure`.

## Running the Project

Make sure the backend API is running first.

Then run the Web project using Visual Studio IIS Express debug mode for develpment.

## Notes

If both the Web and API projects are running in IIS Express debug mode during development, they should connect. The connection configuration can be changed in DSCapWeb/appsetting.json and DSCapWeb/Program.cs