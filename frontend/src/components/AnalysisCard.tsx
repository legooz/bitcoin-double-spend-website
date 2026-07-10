import { formatElapsed, formatProbability, riskLevel } from '../format';
import type { StreamStatus } from '../hooks/useProbabilityStream';

interface Props {
  probability: number;
  confirmations: number;
  elapsed: number;
  isCoinbase: boolean;
  status: StreamStatus;
  pendingAlpha: number;
  onAlphaChange: (alpha: number) => void;
  onAlphaCommit: () => void;
}

const STATUS_LABEL: Record<StreamStatus, string> = {
  idle: 'Idle',
  connecting: 'Connecting…',
  open: 'Connected',
  closed: 'Stream ended',
  error: 'Disconnected',
};

export function AnalysisCard({
  probability,
  confirmations,
  elapsed,
  isCoinbase,
  status,
  pendingAlpha,
  onAlphaChange,
  onAlphaCommit,
}: Props) {
  const risk = riskLevel(probability, confirmations, isCoinbase);
  return (
    <div className="glass-card">
      <div className="analysis-title">Double Spend Analysis</div>

      <div className="risk-panel">
        <div className="data-label">ATTACK PROBABILITY</div>
        <div className="probability-text">{isCoinbase ? 'N/A' : formatProbability(probability)}</div>
        <div className={`risk-text ${risk.className}`}>{risk.label}</div>
        {!isCoinbase && (
          <p className="assumption-note">
            Theoretical estimate that assumes an attacker controls α of the network's hash power.
          </p>
        )}
      </div>

      <div className="meta-row">
        <div className="section-title">LIVE STATUS</div>
        <span className={`status status-${status}`}>{STATUS_LABEL[status]}</span>
      </div>

      <div className="meta-row">
        <div className="section-title">CONFIRMATIONS</div>
        <div className="value-text">{confirmations}</div>
      </div>

      <div className="meta-row">
        <div className="section-title">ELAPSED TIME</div>
        <div className="value-text">{formatElapsed(elapsed)}</div>
      </div>

      <div className="alpha-block">
        <div className="section-title">ATTACKER HASH POWER (α)</div>
        <div className="alpha-row">
          <input
            type="range"
            min="0.01"
            max="0.49"
            step="0.01"
            value={pendingAlpha}
            className="alpha-slider"
            onChange={(e) => onAlphaChange(parseFloat(e.target.value))}
            onPointerUp={onAlphaCommit}
            onKeyUp={onAlphaCommit}
          />
          <span className="alpha-value">{pendingAlpha.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
