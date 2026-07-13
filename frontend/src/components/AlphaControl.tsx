import type { LargestPool } from '../api/client';

interface Props {
  pendingAlpha: number;
  onChange: (alpha: number) => void;
  onCommit: () => void;
  onApply: (alpha: number) => void;
  largestPool: LargestPool | null;
}

const ALPHA_MIN = 0.01;
const ALPHA_MAX = 1;
const CERTAIN_AT = 0.5; // >= 50% hash power => double-spend is certain
// Where 50% sits along the 0.01..1.0 track, as a percentage.
const CERTAIN_PCT = ((CERTAIN_AT - ALPHA_MIN) / (ALPHA_MAX - ALPHA_MIN)) * 100;

export function AlphaControl({ pendingAlpha, onChange, onCommit, onApply, largestPool }: Props) {
  return (
    <div className="card controls-bar">
      <div className="alpha-block">
        <label>
          Attacker hash power (α): <strong>{pendingAlpha.toFixed(2)}</strong>
        </label>
        <div className="alpha-slider-wrap">
          <input
            type="range"
            min={ALPHA_MIN}
            max={ALPHA_MAX}
            step="0.01"
            value={pendingAlpha}
            className="alpha-slider"
            onChange={(e) => onChange(parseFloat(e.target.value))}
            onPointerUp={onCommit}
            onKeyUp={onCommit}
          />
          <span
            className="alpha-tick"
            style={{ left: `${CERTAIN_PCT}%` }}
            title="At 50%+ hash power a double-spend is essentially certain (100%)."
            aria-hidden="true"
          />
          <span className="alpha-tick-label" style={{ left: `${CERTAIN_PCT}%` }}>
            50% · certain
          </span>
        </div>
      </div>

      <div className="alpha-presets">
        <span className="presets-label">Recommended α:</span>
        {largestPool && (
          <button
            className="preset-btn"
            onClick={() => onApply(largestPool.share)}
            title="A mining pool is many independent miners, so this is an upper bound for a single colluding attacker."
          >
            Current largest pool: {largestPool.name} ≈ {Math.round(largestPool.share * 100)}%
          </button>
        )}
        <button
          className="preset-btn"
          onClick={() => onApply(0.51)}
          title="GHash.io briefly exceeded 51% of Bitcoin's hash power in 2014 — enough to double-spend at will."
        >
          GHash.io ≈ 51% (2014)
        </button>
        <button
          className="preset-btn"
          onClick={() => onApply(0.51)}
          title="Any share of 50% or more can always out-mine the honest network, so a double-spend is certain."
        >
          Majority attack (51%)
        </button>
      </div>
    </div>
  );
}
