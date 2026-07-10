import { formatBtc } from '../format';
import type { TransactionSummary } from '../types';

function estimatedFee(tx: TransactionSummary): number | null {
  if (tx.is_coinbase) return null;
  if (tx.inputs.some((i) => i.value == null)) return null;
  const inputTotal = tx.inputs.reduce((sum, i) => sum + (i.value ?? 0), 0);
  const outputTotal = tx.outputs.reduce((sum, o) => sum + o.value, 0);
  const fee = inputTotal - outputTotal;
  return fee >= 0 ? fee : null;
}

export function TransactionDetails({ tx }: { tx: TransactionSummary }) {
  const fee = estimatedFee(tx);
  return (
    <div className="card">
      <h2>Transaction</h2>
      {tx.label && <p className="tx-label">{tx.label}</p>}
      <p className="txid mono">{tx.txid}</p>

      <div className="io-grid">
        <div>
          <h4>Inputs ({tx.inputs.length})</h4>
          <ul>
            {tx.inputs.map((input, i) => (
              <li key={i} className="mono">
                <span className="addr">{input.address ?? 'unknown'}</span>
                <span className="val">{input.value == null ? '' : formatBtc(input.value)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Outputs ({tx.outputs.length})</h4>
          <ul>
            {tx.outputs.map((output, i) => (
              <li key={i} className="mono">
                <span className="addr">{output.addresses[0] ?? 'unknown'}</span>
                <span className="val">{formatBtc(output.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="fee">
        Estimated fee: <strong>{fee == null ? 'N/A' : formatBtc(fee)}</strong>
      </div>
    </div>
  );
}
