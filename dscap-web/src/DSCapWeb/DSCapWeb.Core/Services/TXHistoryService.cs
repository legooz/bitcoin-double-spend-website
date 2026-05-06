using DSCapWeb.Core.Contracts.RepositoryContracts;
using DSCapWeb.Core.Contracts.ServiceContracts;
using DSCapWeb.Core.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DSCapWeb.Core.Services
{
    public class TXHistoryService : ITXHistoryService
    {
        private readonly ITXHistoryRepository _repository;
        public TXHistoryService(ITXHistoryRepository repository)
        {
            _repository = repository;
        }

        public async Task<TransactionHistoryResponseDTO?> GetTransactionHistoryAsync(string transactionId, decimal alpha, int lttbThreshold)
        {
            return await _repository.GetTransactionHistoryAsync(transactionId, alpha, lttbThreshold);
        }
    }
}
