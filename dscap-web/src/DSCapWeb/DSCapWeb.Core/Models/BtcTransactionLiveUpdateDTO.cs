using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DSCapWeb.Core.Models
{
    public class BtcTransactionLiveUpdateDTO
    {
        public string TxId { get; set; } = string.Empty;
        public decimal Alpha { get; set; }
        public int Confirmations { get; set; }
        public double DoubleSpendProbability { get; set; }
        public double ElapsedTime { get; set; }
        public DateTime LastUpdatedUtc { get; set; }
        public string Status { get; set; } = string.Empty;
    }
}
