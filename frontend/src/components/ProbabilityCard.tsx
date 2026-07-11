import { formatElapsed, formatProbability, riskLevel } from '../format';
import type { StreamStatus } from '../hooks/useProbabilityStream';

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
  open: 'Connected',
  closed: 'Stream ended',
  error: 'Disconnected',
};

export function ProbabilityCard({ probability, confirmations, elapsed, isCoinbase, status }: Props) {
  const risk = riskLevel(probability, confirmations, isCoinbase);
  return (
    <div className="card probability-card">
      <div className="prob-main">
        <div className="data-label">{isCoinbase ? 'BLOCK-ORPHAN PROBABILITY' : 'DOUBLE-SPEND PROBABILITY'}</div>
        <div className="probability-text">{formatProbability(probability)}</div>
        <div className={`risk-text ${risk.className}`}>{risk.label}</div>
        <p className="assumption-note">
          {isCoinbase
            ? "The chance the block is orphaned and its reward reversed, assuming an attacker controls α of the network's hash power."
            : "Theoretical estimate that assumes an attacker controls α of the network's hash power."}
        </p>
      </div>

      <div className="prob-stats">
        <div>
          <span className="stat-label">Live status</span>
          <span className={`status status-${status}`}>{STATUS_LABEL[status]}</span>
        </div>
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
