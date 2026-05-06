using DSCapService.Core.Contracts.ServiceContracts;
using DSCapService.Core.Models.DTOs;
using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;

namespace DSCapService.Controllers
{
    [ApiController]
    [Route("/transaction")]
    public class TXController : Controller
    {
        private readonly ITXService _txService;
        public TXController(ITXService tXService)
        {
            _txService = tXService;
        }

        [HttpGet("{transactionId}")]
        public async Task<IActionResult> Get(string transactionId, [FromQuery] decimal alpha)
        {
            var result = await _txService.GetTransaction(transactionId, alpha);

            return result is null
                ? NotFound()
                : Ok(result);
        }

        [HttpGet("{transactionId}/history")]
        public async Task<IActionResult> GetHistory( string transactionId, [FromQuery] decimal alpha, [FromQuery] int lttbThreshold)
        {
            var result = await _txService.GetTransactionHistory(transactionId, alpha, lttbThreshold);

            return result is null
                ? NotFound()
                : Ok(result);
        }

        [HttpPost("{transactionId}/live-update")]
        public async Task<IActionResult> BroadcastLiveUpdate(string transactionId, [FromBody] StartLiveUpdatesRequestDTO request, CancellationToken cancellationToken)
        {
            var success = await _txService.FetchAndBroadcastLiveUpdateAsync(transactionId, request.Alpha, cancellationToken);

            return success 
                ? Accepted(new { message = "Live update broadcast."}) 
                : NotFound();
        }

        [HttpPost("{transactionId}/live/start")]
        public async Task<IActionResult> StartLiveUpdates(string transactionId, [FromBody] StartLiveUpdatesRequestDTO request, CancellationToken cancellationToken)
        {
            await _txService.StartLiveUpdatesAsync(transactionId, request.Alpha, cancellationToken);

            return Ok(new { message = "Live update stream ended." });
        }
    }
}
