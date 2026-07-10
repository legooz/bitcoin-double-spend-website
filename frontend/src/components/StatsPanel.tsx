import { formatElapsed, formatProbability } from '../format';
import type { StreamStatus } from '../hooks/useProbabilityStream';
import { RiskBadge } from './RiskBadge';

interface Props {
  probability: number;
  confirmations: number;
  elapsed: number;
  isCoinbase: boolean;
  status: StreamStatus;
}

const STATUS_LABEL: Record<StreamStatus, string> = {
  idle: 'Idle',
  connecting: 'Connecting…',
  open: 'Live',
  closed: 'Stream ended',
  error: 'Connection error',
};

export function StatsPanel({ probability, confirmations, elapsed, isCoinbase, status }: Props) {
  return (
    <div className="card stats">
      <div className="stats-header">
        <h2>Double-spend risk</h2>
        <span className={`status status-${status}`}>{STATUS_LABEL[status]}</span>
      </div>

      <div className="probability-big">{isCoinbase ? 'N/A' : formatProbability(probability)}</div>
      <RiskBadge probability={probability} confirmations={confirmations} isCoinbase={isCoinbase} />

      <div className="stat-row">
        <div>
          <span className="stat-label">Confirmations</span>
          <span className="stat-value">{confirmations}</span>
        </div>
        <div>
          <span className="stat-label">Elapsed</span>
          <span className="stat-value">{formatElapsed(elapsed)}</span>
        </div>
      </div>
    </div>
  );
}
