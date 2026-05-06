using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace DSCapWeb.Core.Models
{
    public class BtcInputDTO
    {
        [JsonPropertyName("address")]
        public string Address { get; set; } = string.Empty;

        [JsonPropertyName("value")]
        public decimal? Value { get; set; }
    }
}
