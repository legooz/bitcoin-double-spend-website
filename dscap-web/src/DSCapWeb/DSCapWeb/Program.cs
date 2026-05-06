using ApexCharts;
using DSCapWeb.Components;
using DSCapWeb.Core;
using DSCapWeb.Core.Contracts.ServiceContracts;
using DSCapWeb.Core.Services;
using DSCapWeb.Infrastructure;
using DSCapWeb.Infrastructure.Services;
using Microsoft.Extensions.DependencyInjection;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

builder.Services.AddCore(builder.Configuration);
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddScoped<ITXLiveUpdateService, TXLiveUpdateService>();
builder.Services.AddScoped<TransactionHubClient>();
builder.Services.AddApexCharts();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseStaticFiles();
app.UseAntiforgery();

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();
