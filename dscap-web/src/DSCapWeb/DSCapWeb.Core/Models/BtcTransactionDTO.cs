using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace DSCapWeb.Core.Models
{
    public class BtcTransactionDTO
    {
        [JsonPropertyName("txid")]
        public string TxId { get; set; } = string.Empty;

        [JsonPropertyName("confirmations")]
        public int Confirmations { get; set; }
        public List<BtcInputDTO> Inputs { get; set; } = new();

        [JsonPropertyName("outputs")]
        public List<BtcOutputDTO> Outputs { get; set; } = new();

        [JsonPropertyName("blockhash")]
        public string? BlockHash { get; set; }

        [JsonPropertyName("time")]
        public long Time { get; set; }

        [JsonPropertyName("blocktime")]
        public long BlockTime { get; set; }

        [JsonPropertyName("probability")]
        public decimal Probability { get; set; }
    }
}
