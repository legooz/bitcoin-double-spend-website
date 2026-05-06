using DSCapWeb.Core.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DSCapWeb.Core.Contracts.RepositoryContracts
{
    public interface ITXHistoryRepository
    {
        Task<TransactionHistoryResponseDTO?> GetTransactionHistoryAsync(string transactionId, decimal alpha, int lttThreshold);
    }
}
