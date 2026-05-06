using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DSCapService.Core.Models.DTOs
{
    public class TransactionHistoryResponseDTO
    {
        public string TxId { get; set; } = string.Empty;
        public long IncludedBlockHeight { get; set; }
        public long IncludedBlockTime { get; set; }
        public decimal Alpha { get; set; }
        public GraphViewDTO FullGraph { get; set; } = new();
        public GraphViewDTO First5Hours { get; set; } = new();
    }

    public class GraphViewDTO
    {
        public List<ProbabilityPointDTO> Points { get; set; } = new();
    }

    public class ProbabilityPointDTO
    {
        public double ElapsedSeconds { get; set; }
        public double Probability { get; set; }
    }
}
