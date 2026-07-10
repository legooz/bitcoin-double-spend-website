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

export function formatBtc(value: number): string {
  return `${value.toFixed(8)} BTC`;
}

export interface RiskLevel {
  label: string;
  className: string;
}

export function riskLevel(probability: number, confirmations: number, isCoinbase: boolean): RiskLevel {
  if (isCoinbase) return { label: 'Coinbase (no risk)', className: 'risk-safe' };
  if (confirmations >= 6) return { label: 'Confirmed / negligible', className: 'risk-safe' };
  if (probability < 0.01) return { label: 'Negligible risk', className: 'risk-safe' };
  if (probability < 0.1) return { label: 'Low risk', className: 'risk-low' };
  if (probability < 0.5) return { label: 'Moderate risk', className: 'risk-moderate' };
  return { label: 'High risk', className: 'risk-high' };
}
