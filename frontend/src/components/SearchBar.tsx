import { useState } from 'react';

const TXID_RE = /^[0-9a-fA-F]{64}$/;

interface Props {
  onSearch: (txid: string) => void;
  disabled?: boolean;
}

export function SearchBar({ onSearch, disabled }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const cleaned = value.trim().toLowerCase();
    if (!TXID_RE.test(cleaned)) {
      setError('Enter a valid 64-character hexadecimal transaction id.');
      return;
    }
    setError(null);
    onSearch(cleaned);
  };

  return (
    <div className="search">
      <div className="search-row">
        <input
          type="text"
          value={value}
          spellCheck={false}
          placeholder="Bitcoin transaction id (64 hex characters)"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button onClick={submit} disabled={disabled}>
          Analyze
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
