using DSCapService.Core.Models.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace DSCapService.Core.Contracts.ServiceContracts
{
    public interface ITXService
    {
        Task<BtcTransactionDTO?> GetTransaction(string transactionId, decimal alpha);
        Task<TransactionHistoryResponseDTO?> GetTransactionHistory(string transactionId, decimal alpha, int lttbThreshold);
        Task<bool> FetchAndBroadcastLiveUpdateAsync(string transactionId, decimal alpha, CancellationToken cancellationToken = default);
        Task StartLiveUpdatesAsync(string transactionId, decimal alpha, CancellationToken cancellationToken = default);
    }
}
