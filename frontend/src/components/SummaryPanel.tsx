import { useState } from 'react';

import { formatBtc, formatUtc } from '../format';
import type { TransactionSummary } from '../types';

function estimatedFee(tx: TransactionSummary): number | null {
  if (tx.is_coinbase) return null;
  if (tx.inputs.some((i) => i.value == null)) return null;
  const inputTotal = tx.inputs.reduce((sum, i) => sum + (i.value ?? 0), 0);
  const outputTotal = tx.outputs.reduce((sum, o) => sum + o.value, 0);
  const fee = inputTotal - outputTotal;
  return fee >= 0 ? fee : null;
}

export function SummaryPanel({
  tx,
  liveConfirmations,
  explorerLink,
}: {
  tx: TransactionSummary;
  liveConfirmations: number;
  explorerLink: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const fee = estimatedFee(tx);
  const dateMined = tx.blockhash === '' ? 'Mempool (unconfirmed)' : formatUtc(tx.time);

  const copyTxid = async () => {
    try {
      await navigator.clipboard.writeText(tx.txid);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable (e.g. insecure context); ignore.
    }
  };

  return (
    <div className="right-column">
      <div className="summary-grid">
        <div className="summary-card summary-card-full">
          <div className="section-title">TRANSACTION ID</div>
          <div className="txid-row">
            {explorerLink ? (
              <a
                className="hash-text txid-link"
                href={`https://mempool.space/tx/${tx.txid}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {tx.txid}
              </a>
            ) : (
              <span className="hash-text">{tx.txid}</span>
            )}
            <button className="copy-btn" onClick={copyTxid} aria-label="Copy transaction id">
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="summary-card">
          <div className="section-title">DATE MINED (UTC)</div>
          <div className="value-text">{dateMined}</div>
        </div>

        <div className="summary-card">
          <div className="section-title">CONFIRMATIONS</div>
          <div className="value-success">{liveConfirmations}</div>
        </div>

        <div className="summary-card">
          <div className="section-title">ESTIMATED FEE</div>
          <div className={fee != null ? 'value-warning' : 'value-text'}>
            {fee != null ? formatBtc(fee) : tx.is_coinbase ? 'Not applicable' : 'Unavailable'}
          </div>
        </div>

        <div className="summary-card">
          <div className="section-title">BLOCK HASH</div>
          <div className="hash-text">{tx.blockhash || 'N/A'}</div>
        </div>
      </div>

      <div className="io-grid">
        <div className="io-card">
          <div className="section-title value-danger">
            {tx.is_coinbase ? 'COINBASE INPUT' : `INPUTS (${tx.inputs.length})`}
          </div>
          <div className="io-scroll">
            {tx.inputs.map((input, i) => (
              <div className="io-entry" key={i}>
                <div className="addr-text">{tx.is_coinbase ? 'COINBASE' : input.address ?? 'unknown'}</div>
                <div className="value-danger">
                  {input.value != null ? `-${formatBtc(input.value)}` : 'Block Reward'}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="io-card">
          <div className="section-title value-success">OUTPUTS ({tx.outputs.length})</div>
          <div className="io-scroll">
            {tx.outputs.map((output, i) => (
              <div className="io-entry" key={i}>
                <div className="addr-text">{output.addresses[0] ?? 'unknown'}</div>
                <div className="value-success">+{formatBtc(output.value)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
