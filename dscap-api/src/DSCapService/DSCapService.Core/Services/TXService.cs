using DSCapService.Core.Contracts.RepositoryContracts;
using DSCapService.Core.Contracts.ServiceContracts;
using DSCapService.Core.Helpers;
using DSCapService.Core.Models.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace DSCapService.Core.Services
{
    public class TXService : ITXService
    {
        private readonly ITXRepository _txRepository;
        private readonly ITransactionBroadcastService _transactionBroadcastService;
        public TXService(ITXRepository tXRepository, ITransactionBroadcastService transactionBroadcastService)
        {
            _txRepository = tXRepository;
            _transactionBroadcastService = transactionBroadcastService;
        }

        public async Task<BtcTransactionDTO?> GetTransaction(string transactionId, decimal alpha)
        {
            var normalizedAlpha = TransactionSubscriptionHelper.NormalizeAlpha(alpha);
            return await _txRepository.GetTransaction(transactionId, normalizedAlpha);
        }

        public async Task<TransactionHistoryResponseDTO?> GetTransactionHistory(string transactionId, decimal alpha, int lttbThreshold)
        {
            var normalizedAlpha = TransactionSubscriptionHelper.NormalizeAlpha(alpha);

            var raw = await _txRepository.GetTransactionHistory(transactionId, normalizedAlpha, lttbThreshold);

            if (raw is null)
            {
                return null;
            }

            return new TransactionHistoryResponseDTO
            {
                TxId = raw.TxId,
                IncludedBlockHeight = raw.IncludedBlockHeight,
                IncludedBlockTime = raw.IncludedBlockTime,
                Alpha = raw.Alpha,
                FullGraph = new GraphViewDTO
                {
                    Points = MapPoints(raw.Views.FullGraph.Rows)
                },
                First5Hours = new GraphViewDTO
                {
                    Points = MapPoints(raw.Views.First5Hours.Rows)
                }
            };
        }

        public async Task<bool> FetchAndBroadcastLiveUpdateAsync(string transactionId, decimal alpha, CancellationToken cancellationToken = default)
        {
            var normalizedAlpha = TransactionSubscriptionHelper.NormalizeAlpha(alpha);

            var probe = await _txRepository.GetLiveUpdateAsync(transactionId, normalizedAlpha, cancellationToken);

            if (probe is null)
            {
                return false;
            }

            var liveUpdate = MapProbeToLiveUpdate(transactionId, normalizedAlpha, probe);

            await _transactionBroadcastService.BroadcastTransactionUpdateAsync(liveUpdate);

            return true;
        }

        public async Task StartLiveUpdatesAsync(string transactionId, decimal alpha, CancellationToken cancellationToken = default)
        {
            var normalizedAlpha = TransactionSubscriptionHelper.NormalizeAlpha(alpha);

            await _txRepository.StreamLiveUpdatesAsync(transactionId, normalizedAlpha, async probe =>
            {
                var liveUpdate = MapProbeToLiveUpdate(transactionId, normalizedAlpha, probe);
                await _transactionBroadcastService.BroadcastTransactionUpdateAsync(liveUpdate);
            },
            cancellationToken);
        }

        private static BtcTransactionLiveUpdateDTO MapProbeToLiveUpdate(string transactionId, decimal alpha, TransactionUpdateProbeDTO probe)
        {
            return new BtcTransactionLiveUpdateDTO
            {
                TxId = transactionId,
                Alpha = alpha,
                Confirmations = probe.Confirmations,
                DoubleSpendProbability = probe.Probability,
                ElapsedTime = probe.ElapsedTime,
                LastUpdatedUtc = DateTime.UtcNow,
                Status = "Updated"
            };
        }

        private static List<ProbabilityPointDTO> MapPoints(List<List<double>> rows)
        {
            var points = new List<ProbabilityPointDTO>();

            foreach (var row in rows)
            {
                if (row.Count < 2)
                {
                    continue;
                }

                points.Add(new ProbabilityPointDTO
                {
                    ElapsedSeconds = row[0],
                    Probability = row[1]
                });
            }

            return points;
        }
    }
}