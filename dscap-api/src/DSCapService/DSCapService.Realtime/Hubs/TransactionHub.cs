using DSCapService.Core.Helpers;
using Microsoft.AspNetCore.SignalR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DSCapService.Realtime.Hubs
{
    public class TransactionHub : Hub
    {
        public async Task SubscribeToTransaction(string transactionId, decimal alpha)
        {
            var groupKey = TransactionSubscriptionHelper.BuildGroupKey(transactionId, alpha);
            await Groups.AddToGroupAsync(Context.ConnectionId, groupKey);
        }

        public async Task UnsubscribeFromTransaction(string transactionId, decimal alpha)
        {
            var groupKey = TransactionSubscriptionHelper.BuildGroupKey(transactionId, alpha);
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupKey);
        }
    }
}
