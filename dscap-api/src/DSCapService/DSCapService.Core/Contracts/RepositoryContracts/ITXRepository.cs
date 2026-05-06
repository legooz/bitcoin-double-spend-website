using DSCapService.Core.Models.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace DSCapService.Core.Contracts.RepositoryContracts
{
    public interface ITXRepository
    {
        // HTTP
        Task<BtcTransactionDTO?> GetTransaction(string transactionId, decimal alpha);
        Task<TransactionHistoryRawDTO?> GetTransactionHistory(string transactionId, decimal alpha, int lttbThreshold);
        // WS
        Task<TransactionUpdateProbeDTO?> GetLiveUpdateAsync(string transactionId, decimal alpha, CancellationToken cancellationToken = default);
        Task StreamLiveUpdatesAsync(string transactionId, decimal alpha, Func<TransactionUpdateProbeDTO, Task> onUpdate, CancellationToken cancellationToken = default);

    }
}
