// Shared formatting helpers.

export function formatProbability(probability: number): string {
  if (probability < 0) return 'N/A';
  if (probability === 0) return '0%';
  const percent = probability * 100;
  if (percent < 0.01) return `${percent.toExponential(2)}%`;
  return `${percent.toFixed(2)}%`;
}

export function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

// Compact UTC date-time for chart axis ticks, e.g. "May 22 '10 6:26p".
export function formatAxisDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const mon = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const day = d.getUTCDate();
  const yr = String(d.getUTCFullYear()).slice(2);
  let hour = d.getUTCHours();
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const ap = hour >= 12 ? 'p' : 'a';
  hour = hour % 12 || 12;
  return `${mon} ${day} '${yr} ${hour}:${min}${ap}`;
}

export function formatBtc(value: number): string {
  return `${value.toFixed(8)} BTC`;
}

export function formatUtc(unixSeconds: number): string {
  if (unixSeconds < 0) return 'Mempool';
  return `${new Date(unixSeconds * 1000).toISOString().replace('T', ' ').slice(0, 19)} UTC`;
}

export interface RiskLevel {
  label: string;
  className: string;
}

export function riskLevel(probability: number, _confirmations: number, _isCoinbase: boolean): RiskLevel {
  if (probability < 0.01) return { label: 'Negligible risk', className: 'value-success' };
  if (probability < 0.1) return { label: 'Low risk', className: 'value-success' };
  if (probability < 0.5) return { label: 'Moderate risk', className: 'value-warning' };
  return { label: 'High risk', className: 'value-danger' };
}
