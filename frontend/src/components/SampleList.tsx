import type { SampleTransaction } from '../types';

interface Props {
  samples: SampleTransaction[];
  onSelect: (txid: string) => void;
}

export function SampleList({ samples, onSelect }: Props) {
  if (samples.length === 0) return null;
  return (
    <div className="samples">
      <span className="samples-label">Try a sample:</span>
      {samples.map((sample) => (
        <button key={sample.txid} className="sample-chip" onClick={() => onSelect(sample.txid)}>
          {sample.label}
        </button>
      ))}
    </div>
  );
}
