import { useState } from 'react';

interface Props {
  pendingAlpha: number;
  onChange: (alpha: number) => void;
  onCommit: () => void;
}

export function AlphaControl({ pendingAlpha, onChange, onCommit }: Props) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable (e.g. insecure context); ignore.
    }
  };

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
      <button className="copy-btn" onClick={copyLink} aria-label="Copy shareable link">
        {copied ? 'Link copied' : 'Copy link'}
      </button>
    </div>
  );
}
