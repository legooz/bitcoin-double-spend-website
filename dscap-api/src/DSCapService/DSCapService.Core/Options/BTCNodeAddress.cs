using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection.PortableExecutable;
using System.Text;
using System.Threading.Tasks;

namespace DSCapService.Core.Options
{
    public class BTCNodeAddress
    {
        public const string SectionName = "BTCNode";
        public string BaseAddress { get; set; } = "";
        public string WebSocketBaseAddress { get; set; } = "";
    }
}
