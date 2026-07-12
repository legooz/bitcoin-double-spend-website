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

function AddressCell({ address, explorerLink }: { address: string | null; explorerLink: boolean }) {
  const text = address ?? 'unknown';
  if (explorerLink && address && address !== 'COINBASE') {
    return (
      <a
        className="addr-text addr-link"
        href={`https://bitref.com/${address}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {text}
      </a>
    );
  }
  return <div className="addr-text">{text}</div>;
}

interface Props {
  tx: TransactionSummary;
  liveConfirmations: number;
  explorerLink: boolean;
}

export function SummaryPanel({ tx, liveConfirmations, explorerLink }: Props) {
  const fee = estimatedFee(tx);
  const dateMined = tx.blockhash === '' ? 'Mempool (unconfirmed)' : formatUtc(tx.time);

  return (
    <div className="right-column">
      <div className="summary-grid">
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
          {explorerLink && tx.blockhash ? (
            <a
              className="hash-text txid-link"
              href={`https://mempool.space/block/${tx.blockhash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {tx.blockhash}
            </a>
          ) : (
            <div className="hash-text">{tx.blockhash || 'N/A'}</div>
          )}
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
                <AddressCell address={tx.is_coinbase ? 'COINBASE' : input.address} explorerLink={explorerLink} />
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
                <AddressCell address={output.addresses[0] ?? null} explorerLink={explorerLink} />
                <div className="value-success">+{formatBtc(output.value)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
