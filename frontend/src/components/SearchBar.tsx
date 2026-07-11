import { useState } from 'react';

// Matches a 64-hex transaction id anywhere in the input, so a pasted
// block-explorer URL (mempool.space, blockchain.com, blockstream, …) works too.
const TXID_RE = /[0-9a-fA-F]{64}/;

interface Props {
  onSearch: (txid: string) => void;
  disabled?: boolean;
}

export function SearchBar({ onSearch, disabled }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const match = value.trim().match(TXID_RE);
    if (!match) {
      setError('Enter a transaction id (64 hex characters), or paste a block-explorer link.');
      return;
    }
    setError(null);
    onSearch(match[0].toLowerCase());
  };

  return (
    <>
      <div className="search-shell">
        <input
          className="hero-search-input"
          type="text"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          maxLength={64}
          placeholder="Transaction ID, or paste a block-explorer link"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button className="hero-search-button" onClick={submit} disabled={disabled}>
          Analyze
        </button>
      </div>
      {error && <p className="notice error">{error}</p>}
    </>
  );
}
