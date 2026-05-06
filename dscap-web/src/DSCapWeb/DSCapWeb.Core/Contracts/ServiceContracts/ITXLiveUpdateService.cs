using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace DSCapWeb.Core.Contracts.ServiceContracts
{
    public interface ITXLiveUpdateService
    {
        Task StartLiveUpdatesAsync(string transactionId, decimal alpha, CancellationToken cancellationToken = default);
    }
}
