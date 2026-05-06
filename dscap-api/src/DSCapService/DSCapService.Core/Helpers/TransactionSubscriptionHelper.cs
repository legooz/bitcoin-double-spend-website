using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DSCapService.Core.Helpers
{
    public static class TransactionSubscriptionHelper
    {
        public static decimal NormalizeAlpha(decimal alpha)
        {
            if (alpha < 0m || alpha > 1m)
            {
                throw new ArgumentOutOfRangeException(nameof(alpha), "Alpha must be between 0.00 and 1.00.");
            }

            return Math.Round(alpha, 2, MidpointRounding.AwayFromZero);
        }

        public static string FormatAlpha(decimal alpha)
        {
            return NormalizeAlpha(alpha).ToString("F2", CultureInfo.InvariantCulture);
        }

        public static string BuildGroupKey(string transactionId, decimal alpha)
        {
            return $"{transactionId}:{FormatAlpha(alpha)}";
        }
    }
}
