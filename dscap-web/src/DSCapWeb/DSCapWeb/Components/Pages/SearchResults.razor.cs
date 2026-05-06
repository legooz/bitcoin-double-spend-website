using DSCapWeb.Core.Contracts.ServiceContracts;
using DSCapWeb.Core.Models;
using DSCapWeb.Core.Services;
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Web;
using System.Globalization;
using System.Text.RegularExpressions;

namespace DSCapWeb.Components.Pages
{
    public partial class SearchResults : IAsyncDisposable
    {
        private const double FiveHoursInSeconds = 5 * 60 * 60;

        [Inject]
        public ITXSummaryService TXSummaryService { get; set; } = default!;

        [Inject]
        public ITXHistoryService TXHistoryService { get; set; } = default!;

        [Inject]
        public ITXLiveUpdateService TXLiveUpdateService { get; set; } = default!;

        [Inject]
        public TransactionHubClient HubClient { get; set; } = default!;

        [Inject]
        public IConfiguration Configuration { get; set; } = default!;

        [Inject]
        public NavigationManager Nav { get; set; } = default!;

        [Parameter]
        [SupplyParameterFromQuery(Name = "query")]
        public string? Query { get; set; }

        public BtcTransactionDTO? TXSummary { get; private set; }
        public TransactionHistoryResponseDTO? TXHistory { get; private set; }
        public string? ErrorMessage { get; private set; }
        public string? HistoryErrorMessage { get; private set; }

        public int LiveConfirmations { get; private set; }
        public double LiveProbability { get; private set; }
        public double LiveElapsedTime { get; private set; }
        public DateTime? LastUpdatedUtc { get; private set; }
        public bool IsLiveConnected { get; private set; }

        public decimal CurrentAlpha { get; private set; } = 0.15m;
        public int LttbThreshold { get; private set; } = 1000;
        public string PendingLttbThresholdText { get; set; } = "1000";

        public bool Loading { get; private set; }
        public bool HistoryLoading { get; private set; }

        public List<ProbabilityPointDTO> FullHistoryPoints =>
            TXHistory?.FullGraph?.Points ?? new();

        public List<ProbabilityPointDTO> First5HoursPoints =>
            TXHistory?.First5Hours?.Points ?? new();

        public List<ProbabilityPointDTO> ConfirmationBased5HourPoints =>
            FullHistoryPoints
                .Where(p => p.ElapsedSeconds <= FiveHoursInSeconds)
                .ToList();

        public bool HasHistoryGraphs => TXHistory is not null;

        public bool HasAnyGraphs => HasHistoryGraphs || LivePoints.Any() || IsLiveConnected;

        protected string searchText = string.Empty;

        private string? _currentTransactionId;
        private bool _hubStarted;
        private CancellationTokenSource? _liveStreamCts;
        private Task? _liveStreamTask;
        private string? _subscribedTransactionId;
        private decimal? _subscribedAlpha;
        private int _loadVersion;
        private double _lastLiveElapsedTime;

        public bool IsCoinbaseTransaction =>
        TXSummary?.Inputs is not null &&
        TXSummary.Inputs.Any() &&
        string.Equals(TXSummary.Inputs[0].Address, "COINBASE", StringComparison.OrdinalIgnoreCase);

        private LiveProbabilityGraph? LiveGraph;

        public List<ProbabilityPointDTO> LivePoints { get; private set; } = new();

        public decimal? EstimatedFeeBtc
        {
            get
            {
                if (TXSummary is null || IsCoinbaseTransaction)
                    return null;

                if (TXSummary.Inputs is null || TXSummary.Outputs is null)
                    return null;

                if (TXSummary.Inputs.Any(i => !i.Value.HasValue))
                    return null;

                var inputTotal = TXSummary.Inputs.Sum(i => i.Value ?? 0m);
                var outputTotal = TXSummary.Outputs.Sum(o => o.Value);

                var fee = inputTotal - outputTotal;

                return fee >= 0 ? fee : null;
            }
        }

        public string EstimatedFeeDisplay =>
            IsCoinbaseTransaction
                ? "Not Applicable"
                : EstimatedFeeBtc.HasValue
                    ? $"{EstimatedFeeBtc.Value:F8} BTC"
                    : "Unavailable";

        private string? validationMessage;

        private static readonly Regex TxidRegex =
            new("^[A-Fa-f0-9]{64}$", RegexOptions.Compiled);

        public bool IsPendingOrUnsupportedTransaction =>
            TXSummary is not null &&
            string.Equals(TXSummary.BlockHash, "-1", StringComparison.Ordinal);

        public bool CanShowGraphs =>
            TXSummary is not null &&
            !IsPendingOrUnsupportedTransaction &&
            !IsCoinbaseTransaction;

        private void HandleInput(ChangeEventArgs e)
        {
            searchText = e.Value?.ToString() ?? string.Empty;
            validationMessage = null;
        }

        protected override async Task OnParametersSetAsync()
        {
            ErrorMessage = null;
            searchText = Query ?? string.Empty;

            if (string.IsNullOrWhiteSpace(Query))
            {
                _loadVersion++;
                await StopCurrentLiveStreamAsync();
                TXSummary = null;
                TXHistory = null;
                HistoryErrorMessage = null;
                HistoryLoading = false;
                LivePoints = new();
                _currentTransactionId = null;
                Loading = false;
                return;
            }

            try
            {
                Loading = true;

                if (!_hubStarted)
                {
                    var apiBaseUrl = Configuration["DSCapWebSettings:ApiBaseUrl"]
                        ?? throw new InvalidOperationException("ApiBaseUrl is missing.");

                    var hubUrl = $"{apiBaseUrl.TrimEnd('/')}/hubs/transactions";

                    HubClient.OnTransactionUpdated += HandleTransactionUpdated;
                    await HubClient.StartAsync(hubUrl);
                    _hubStarted = true;
                }

                if (_currentTransactionId != Query)
                {
                    await StopCurrentLiveStreamAsync();
                    await LoadAndStartAsync(Query, CurrentAlpha, LttbThreshold);
                }
            }
            catch (Exception ex)
            {
                ErrorMessage = ex.Message;
            }
            finally
            {
                Loading = false;
            }
        }

        private async Task ApplySettingsAsync()
        {
            if (string.IsNullOrWhiteSpace(_currentTransactionId))
                return;

            if (!CanShowGraphs)
                return;

            ErrorMessage = null;
            HistoryErrorMessage = null;

            if (!int.TryParse(PendingLttbThresholdText, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsedThreshold)
                || parsedThreshold <= 0)
            {
                ErrorMessage = "Enter a valid positive LTTB threshold.";
                return;
            }

            CurrentAlpha = Math.Round(CurrentAlpha, 2, MidpointRounding.AwayFromZero);

            Loading = true;
            try
            {
                await StopCurrentLiveStreamAsync();
                await LoadAndStartAsync(_currentTransactionId, CurrentAlpha, parsedThreshold);
            }
            catch (Exception ex)
            {
                ErrorMessage = ex.Message;
            }
            finally
            {
                Loading = false;
            }
        }

        private async Task LoadAndStartAsync(string transactionId, decimal alpha, int lttbThreshold)
        {
            var loadVersion = ++_loadVersion;

            CurrentAlpha = Math.Round(alpha, 2, MidpointRounding.AwayFromZero);
            LttbThreshold = lttbThreshold;
            PendingLttbThresholdText = lttbThreshold.ToString(CultureInfo.InvariantCulture);
            _currentTransactionId = transactionId;

            TXSummary = await TXSummaryService.GetTXSummaryAsync(transactionId, CurrentAlpha);

            if (TXSummary is null)
            {
                ErrorMessage = $"No results found for: {transactionId}";
                TXHistory = null;
                HistoryErrorMessage = null;
                HistoryLoading = false;
                LivePoints = new();
                IsLiveConnected = false;
                return;
            }

            TXSummary.Inputs ??= new();
            TXSummary.Outputs ??= new();

            LiveConfirmations = TXSummary.Confirmations;
            LiveProbability = (double)TXSummary.Probability;
            LiveElapsedTime = 0;
            LastUpdatedUtc = null;
            ErrorMessage = null;

            LivePoints = new();
            _lastLiveElapsedTime = 0;

            TXHistory = null;
            HistoryErrorMessage = null;
            HistoryLoading = false;

            if (!CanShowGraphs)
            {
                IsLiveConnected = false;
                return;
            }

            HistoryLoading = true;

            await HubClient.SubscribeAsync(transactionId, CurrentAlpha);
            _subscribedTransactionId = transactionId;
            _subscribedAlpha = CurrentAlpha;
            IsLiveConnected = true;

            _liveStreamCts = new CancellationTokenSource();
            var token = _liveStreamCts.Token;

            _liveStreamTask = StartLiveStreamAsync(transactionId, CurrentAlpha, token, loadVersion);
            _ = LoadHistoryAsync(transactionId, CurrentAlpha, lttbThreshold, loadVersion);
        }

        private async Task StartLiveStreamAsync(string transactionId, decimal alpha, CancellationToken token, int loadVersion)
        {
            try
            {
                await TXLiveUpdateService.StartLiveUpdatesAsync(transactionId, alpha, token);
            }
            catch (OperationCanceledException)
            {
            }
            catch (Exception ex)
            {
                if (loadVersion != _loadVersion)
                    return;

                ErrorMessage = ex.Message;
                IsLiveConnected = false;
                await InvokeAsync(StateHasChanged);
            }
        }

        private async Task LoadHistoryAsync(string transactionId, decimal alpha, int lttbThreshold, int loadVersion)
        {
            try
            {
                var history = await TXHistoryService.GetTransactionHistoryAsync(transactionId, alpha, lttbThreshold);

                if (loadVersion != _loadVersion || transactionId != _currentTransactionId || alpha != CurrentAlpha || lttbThreshold != LttbThreshold)
                    return;

                TXHistory = history;

                if (history is null)
                {
                    HistoryErrorMessage = "Historical graph data was not returned by the API.";
                }
                else
                {
                    HistoryErrorMessage = null;
                }
            }
            catch (Exception ex)
            {
                if (loadVersion != _loadVersion)
                    return;

                HistoryErrorMessage = $"History load failed: {ex.Message}";
            }
            finally
            {
                if (loadVersion == _loadVersion)
                {
                    HistoryLoading = false;
                    await InvokeAsync(StateHasChanged);
                }
            }
        }

        private async Task StopCurrentLiveStreamAsync()
        {
            if (!string.IsNullOrWhiteSpace(_subscribedTransactionId) && _subscribedAlpha.HasValue)
            {
                try
                {
                    await HubClient.UnsubscribeAsync(_subscribedTransactionId, _subscribedAlpha.Value);
                }
                catch
                {
                }
            }

            _subscribedTransactionId = null;
            _subscribedAlpha = null;

            if (_liveStreamCts is not null)
            {
                _liveStreamCts.Cancel();
            }

            if (_liveStreamTask is not null)
            {
                try
                {
                    await _liveStreamTask;
                }
                catch (OperationCanceledException)
                {
                }
                catch
                {
                }
            }

            _liveStreamCts?.Dispose();
            _liveStreamCts = null;
            _liveStreamTask = null;

            IsLiveConnected = false;
        }

        private async Task HandleTransactionUpdated(BtcTransactionLiveUpdateDTO update)
        {
            if (string.IsNullOrWhiteSpace(_currentTransactionId))
                return;

            if (update.TxId != _currentTransactionId || update.Alpha != CurrentAlpha)
                return;

            LiveConfirmations = update.Confirmations;
            LiveProbability = update.DoubleSpendProbability;
            LiveElapsedTime = update.ElapsedTime;
            LastUpdatedUtc = update.LastUpdatedUtc;

            if (update.ElapsedTime > _lastLiveElapsedTime)
            {
                LivePoints.Add(new ProbabilityPointDTO
                {
                    ElapsedSeconds = update.ElapsedTime,
                    Probability = update.DoubleSpendProbability
                });

                _lastLiveElapsedTime = update.ElapsedTime;
            }

            await InvokeAsync(StateHasChanged);

            if (LiveGraph is not null)
            {
                await LiveGraph.RefreshAsync();
            }
        }

        private void Search()
        {
            validationMessage = null;

            var cleaned = (searchText ?? string.Empty).Trim();

            if (string.IsNullOrWhiteSpace(cleaned))
            {
                validationMessage = "Please enter a transaction hash.";
                return;
            }

            if (!TxidRegex.IsMatch(cleaned))
            {
                validationMessage = "Please enter a valid Bitcoin transaction hash (64 hexadecimal characters).";
                return;
            }

            Nav.NavigateTo($"/search?query={Uri.EscapeDataString(cleaned.ToLowerInvariant())}");
        }

        private void HandleKeyPress(KeyboardEventArgs e)
        {
            if (e.Key == "Enter")
            {
                Search();
            }
        }

        public string FormatProbability(double probability)
        {
            if (probability < 0)
                return "N/A";

            double percent = probability * 100;

            if (percent < 0.01 && percent > 0)
                return percent.ToString("E2", CultureInfo.InvariantCulture) + "%";

            return percent.ToString("F2", CultureInfo.InvariantCulture) + "%";
        }

        private string FormatScientific(double value)
        {
            if (double.IsNaN(value) || double.IsInfinity(value))
                return "N/A";

            if (value == 0)
                return "0";

            var expString = value.ToString("E4"); // example: 1.2345E-06
            var parts = expString.Split('E');

            var mantissa = parts[0];
            var exponent = int.Parse(parts[1]);

            return $"{mantissa} × 10{ToSuperscript(exponent)}";
        }

        private string ToSuperscript(int exponent)
        {
            return string.Concat(exponent.ToString().Select(c => c switch
            {
                '-' => '⁻',
                '0' => '⁰',
                '1' => '¹',
                '2' => '²',
                '3' => '³',
                '4' => '⁴',
                '5' => '⁵',
                '6' => '⁶',
                '7' => '⁷',
                '8' => '⁸',
                '9' => '⁹',
                _ => c
            }));
        }

        public DateTime? GetTimeMinedUtc()
        {
            if (TXSummary is null || TXSummary.Time < 0)
                return null;

            return DateTimeOffset.FromUnixTimeSeconds(TXSummary.Time).UtcDateTime;
        }

        public string RiskLabel =>
            IsCoinbaseTransaction ? "Coinbase Transaction" :
            LiveConfirmations < 1 ? "In Mempool" :
            LiveConfirmations > 100 ? "Too Old" :
            LiveProbability < 0.01 ? "Negligible Risk" :
            LiveProbability < 0.10 ? "Low Risk" :
            LiveProbability < 0.50 ? "Moderate Risk" :
            "High Risk";

        public string RiskTextClass =>
            IsCoinbaseTransaction ? "value-warning" :
            LiveConfirmations < 1 ? "value-warning" :
            LiveConfirmations > 100 ? "value-danger" :
            LiveProbability < 0.01 ? "value-success" :
            LiveProbability < 0.10 ? "risk-text value-success" :
            LiveProbability < 0.50 ? "risk-text value-warning" :
            "risk-text value-danger";

        public string ProbabilityDisplay =>
    LiveProbability < 0 ? "Unavailable" : FormatScientific(LiveProbability);

        public string TimeMinedDisplay =>
    TXSummary is null || TXSummary.Time < 0
        ? "Mempool"
        : DateTimeOffset.FromUnixTimeSeconds(TXSummary.Time).UtcDateTime.ToString("yyyy-MM-dd HH:mm:ss");

        private void OnAlphaSliderChanged(ChangeEventArgs e)
        {
            if (e.Value is null)
                return;

            if (decimal.TryParse(e.Value.ToString(), CultureInfo.InvariantCulture, out var value))
            {
                CurrentAlpha = Math.Round(value, 2, MidpointRounding.AwayFromZero);
            }
        }

        public async ValueTask DisposeAsync()
        {
            HubClient.OnTransactionUpdated -= HandleTransactionUpdated;
            await StopCurrentLiveStreamAsync();
        }
    }
}
