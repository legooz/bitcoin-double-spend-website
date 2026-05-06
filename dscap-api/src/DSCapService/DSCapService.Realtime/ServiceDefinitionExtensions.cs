using DSCapService.Core.Contracts.ServiceContracts;
using DSCapService.Realtime.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace DSCapService.Realtime
{
    public static class ServiceDefinitionExtensions
    {
        public static IServiceCollection AddRealtimeServices(this IServiceCollection services, ConfigurationManager configuration)
        {
            services.AddSignalR();
            services.AddScoped<ITransactionBroadcastService, TransactionBroadcastService>();

            return services;
        }
    }
}
