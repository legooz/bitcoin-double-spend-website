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
    public class TXSummaryService : ITXSummaryService
    {
        private readonly ITXSummaryRepository _repository;
        public TXSummaryService(ITXSummaryRepository repository)
        {
            _repository = repository;
        }

        public async Task<BtcTransactionDTO?> GetTXSummaryAsync(string txId, decimal alpha)
        {
            return await _repository.GetTXSummaryAsync(txId, alpha);
        }
    }
}
