using DSCapService.Core.Contracts.ServiceContracts;
using DSCapService.Core.Options;
using DSCapService.Core.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DSCapService.Core
{
    public static class ServiceDefinitionExtensions
    {
        public static void AddCore(this IServiceCollection service, ConfigurationManager configuration)
        {
            _ = service.AddTransient<ITXService, TXService>();
        }
    }
}
