using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace DSCapWeb.Core.Models
{
    public class BtcOutputDTO
    {
        [JsonPropertyName("value")]
        public decimal Value { get; set; }

        [JsonPropertyName("addresses")]
        public List<string> Addresses { get; set; } = new();
    }
}
