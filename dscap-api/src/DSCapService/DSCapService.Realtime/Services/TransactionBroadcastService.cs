using DSCapService.Core.Contracts.ServiceContracts;
using DSCapService.Core.Helpers;
using DSCapService.Core.Models.DTOs;
using DSCapService.Realtime.Hubs;
using Microsoft.AspNetCore.SignalR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DSCapService.Realtime.Services
{
    public class TransactionBroadcastService : ITransactionBroadcastService
    {
        private readonly IHubContext<TransactionHub> _hubContext;
        public TransactionBroadcastService(IHubContext<TransactionHub> hubContext)
        {
            _hubContext = hubContext;
        }

        public async Task BroadcastTransactionUpdateAsync(BtcTransactionLiveUpdateDTO update)
        {
            if (string.IsNullOrWhiteSpace(update.TxId))
            {
                return;
            }

            var groupKey = TransactionSubscriptionHelper.BuildGroupKey(update.TxId, update.Alpha);

            await _hubContext.Clients.Group(groupKey).SendAsync("ReceiveTransactionUpdate", update);
        }
    }
}