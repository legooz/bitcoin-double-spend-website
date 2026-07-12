import { useState } from 'react';

interface Props {
  txid: string;
  explorerLink: boolean;
}

// Compact header shown at the top of the results: the transaction id (linking to
// a block explorer in real-data mode), plus copy-id and copy-shareable-link.
export function TransactionHeader({ txid, explorerLink }: Props) {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const copy = async (text: string, setFlag: (value: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setFlag(true);
      setTimeout(() => setFlag(false), 1500);
    } catch {
      // Clipboard may be unavailable (e.g. insecure context); ignore.
    }
  };

  return (
    <div className="card txid-header">
      <div className="section-title">TRANSACTION ID</div>
      <div className="txid-row">
        {explorerLink ? (
          <a
            className="hash-text txid-link"
            href={`https://bitref.com/tx/${txid}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {txid}
          </a>
        ) : (
          <span className="hash-text">{txid}</span>
        )}
        <div className="txid-actions">
          <button className="copy-btn" onClick={() => copy(txid, setCopiedId)} aria-label="Copy transaction id">
            {copiedId ? 'Copied' : 'Copy ID'}
          </button>
          <button
            className="copy-btn"
            onClick={() => copy(window.location.href, setCopiedLink)}
            aria-label="Copy shareable link"
          >
            {copiedLink ? 'Link copied' : 'Copy link'}
          </button>
        </div>
      </div>
    </div>
  );
}
