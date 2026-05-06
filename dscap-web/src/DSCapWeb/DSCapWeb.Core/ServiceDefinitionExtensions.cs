using DSCapWeb.Core.Contracts.ServiceContracts;
using DSCapWeb.Core.Options;
using DSCapWeb.Core.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace DSCapWeb.Core
{
    public static class ServiceDefinitionExtensions
    {
        public static void AddCore(this IServiceCollection service, ConfigurationManager configuration)
        {
            _ = service.AddTransient<ITXSummaryService, TXSummaryService>();
            _ = service.AddTransient<ITXHistoryService, TXHistoryService>();

            AddConfiguration(service, configuration);
        }

        private static void AddConfiguration(IServiceCollection service, ConfigurationManager configuration)
        {
            service.Configure<DSCapWebSettings>(configuration.GetSection("DSCapWebSettings"));
        }
    }
}
