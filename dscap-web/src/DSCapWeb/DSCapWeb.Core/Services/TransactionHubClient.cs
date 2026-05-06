using DSCapWeb.Core.Models;
using Microsoft.AspNetCore.SignalR.Client;

namespace DSCapWeb.Core.Services
{
    public class TransactionHubClient : IAsyncDisposable
    {
        private HubConnection? _hubConnection;

        public event Func<BtcTransactionLiveUpdateDTO, Task>? OnTransactionUpdated;

        public bool IsConnected => _hubConnection?.State == HubConnectionState.Connected;

        public async Task StartAsync(string hubUrl)
        {
            if (_hubConnection is not null)
            {
                return;
            }

            _hubConnection = new HubConnectionBuilder().WithUrl(hubUrl).WithAutomaticReconnect().Build();

            _hubConnection.On<BtcTransactionLiveUpdateDTO>("ReceiveTransactionUpdate", async update =>
            {
                if (OnTransactionUpdated is not null)
                {
                    await OnTransactionUpdated.Invoke(update);
                }
            });

            await _hubConnection.StartAsync();
        }

        public async Task SubscribeAsync(string transactionId, decimal alpha)
        {
            if (_hubConnection is null)
            {
                throw new InvalidOperationException("Hub connection has not been started.");
            }

            await _hubConnection.SendAsync("SubscribeToTransaction", transactionId, alpha);
        }

        public async Task UnsubscribeAsync(string transactionId, decimal alpha)
        {
			var hubConnection = _hubConnection;

			if (hubConnection is null)
			{
				return;
			}

			if (hubConnection.State != HubConnectionState.Connected)
			{
				return;
			}

			try
			{
				await hubConnection.SendAsync("UnsubscribeFromTransaction", transactionId, alpha);
			}
			catch (ObjectDisposedException)
			{
				// Safe to ignore during shutdown/disposal.
			}
			catch (InvalidOperationException)
			{
				// Safe to ignore if connection is closing/disconnected.
			}
		}

        public async ValueTask DisposeAsync()
        {
            if (_hubConnection is not null)
            {
                await _hubConnection.DisposeAsync();
            }
        }
    }
}
