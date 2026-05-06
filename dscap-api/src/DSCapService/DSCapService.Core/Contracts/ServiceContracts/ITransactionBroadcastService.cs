using DSCapService.Core.Models.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DSCapService.Core.Contracts.ServiceContracts
{
    public interface ITransactionBroadcastService
    {
        Task BroadcastTransactionUpdateAsync(BtcTransactionLiveUpdateDTO update);
    }
}
 