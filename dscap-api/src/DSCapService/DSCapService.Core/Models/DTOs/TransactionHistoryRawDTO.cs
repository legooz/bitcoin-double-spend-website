using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace DSCapService.Core.Models.DTOs
{
    public class TransactionHistoryRawDTO
    {
        [JsonPropertyName("txid")]
        public string TxId { get; set; } = string.Empty;

        [JsonPropertyName("included_block_height")]
        public long IncludedBlockHeight { get; set; }

        [JsonPropertyName("included_block_time")]
        public long IncludedBlockTime { get; set; }

        [JsonPropertyName("alpha")]
        public decimal Alpha { get; set; }

        [JsonPropertyName("views")]
        public TransactionHistoryViewsRawDTO Views { get; set; } = new();

        public class TransactionHistoryViewsRawDTO
        {
            [JsonPropertyName("full_graph")]
            public GraphRowsRawDTO FullGraph { get; set; } = new();

            [JsonPropertyName("first_5h")]
            public GraphRowsRawDTO First5Hours { get; set; } = new();
        }

        public class GraphRowsRawDTO
        {
            [JsonPropertyName("columns")]
            public List<string> Columns { get; set; } = new();

            [JsonPropertyName("rows")]
            public List<List<double>> Rows { get; set; } = new();
        }
    }
}
