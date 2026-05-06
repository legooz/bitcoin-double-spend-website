using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace DSCapService.Core.Models.DTOs
{
    public class TransactionUpdateProbeDTO
    {
        [JsonPropertyName("confirmations")]
        public int Confirmations { get; set; }

        [JsonPropertyName("probability")]
        public double Probability { get; set; }

        [JsonPropertyName("Time")]
        public double ElapsedTime { get; set; }
    }
}
