using DSCapWeb.Core.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DSCapWeb.Core.Contracts.ServiceContracts
{
    public interface ITXSummaryService
    {
        Task<BtcTransactionDTO?> GetTXSummaryAsync(string txId, decimal alpha);
    }
}
