import type { LargestPool } from '../api/client';

interface Props {
  pendingAlpha: number;
  onChange: (alpha: number) => void;
  onCommit: () => void;
  onApply: (alpha: number) => void;
  largestPool: LargestPool | null;
}

export function AlphaControl({ pendingAlpha, onChange, onCommit, onApply, largestPool }: Props) {
  return (
    <div className="card controls-bar">
      <div className="alpha-block">
        <label>
          Attacker hash power (α): <strong>{pendingAlpha.toFixed(2)}</strong>
        </label>
        <input
          type="range"
          min="0.01"
          max="0.49"
          step="0.01"
          value={pendingAlpha}
          className="alpha-slider"
          onChange={(e) => onChange(parseFloat(e.target.value))}
          onPointerUp={onCommit}
          onKeyUp={onCommit}
        />
      </div>

      <div className="alpha-presets">
        {largestPool && (
          <button
            className="preset-btn"
            onClick={() => onApply(largestPool.share)}
            title="A mining pool is many independent miners, so this is an upper bound for a single colluding attacker."
          >
            Largest pool: {largestPool.name} ≈ {Math.round(largestPool.share * 100)}%
          </button>
        )}
        <button className="preset-btn" onClick={() => onApply(0.49)}>
          Majority attack (49%)
        </button>
      </div>
    </div>
  );
}
