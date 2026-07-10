import { useCallback, useEffect, useState } from 'react';

import {
  ApiError,
  fetchHealth,
  fetchHistory,
  fetchMempoolSample,
  fetchSamples,
  fetchTransaction,
} from './api/client';
import { ProbabilityChart } from './components/ProbabilityChart';
import { SampleList } from './components/SampleList';
import { SearchBar } from './components/SearchBar';
import { StatsPanel } from './components/StatsPanel';
import { TransactionDetails } from './components/TransactionDetails';
import { useProbabilityStream } from './hooks/useProbabilityStream';
import type { HistoryResponse, SampleTransaction, TransactionSummary } from './types';

export default function App() {
  const [committedAlpha, setCommittedAlpha] = useState(0.15);
  const [pendingAlpha, setPendingAlpha] = useState(0.15);
  const [activeTxid, setActiveTxid] = useState<string | null>(null);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [samples, setSamples] = useState<SampleTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string>('demo');

  const canStream = summary != null && !summary.is_coinbase;
  const { latest, points, status } = useProbabilityStream(activeTxid, committedAlpha, canStream);

  useEffect(() => {
    fetchSamples().then(setSamples).catch(() => undefined);
    fetchHealth().then((h) => setDataSource(h.data_source)).catch(() => undefined);
  }, []);

  const load = useCallback(async (txid: string, alpha: number) => {
    setLoading(true);
    setError(null);
    setHistory(null);
    setSummary(null);
    try {
      const result = await fetchTransaction(txid, alpha);
      setSummary(result);
      setActiveTxid(txid);
      if (!result.is_coinbase) {
        fetchHistory(txid, alpha)
          .then(setHistory)
          .catch(() => setHistory(null));
      }
    } catch (err) {
      setActiveTxid(null);
      setError(err instanceof ApiError ? err.message : 'Failed to load transaction.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = (txid: string) => load(txid, committedAlpha);

  const commitAlpha = () => {
    setCommittedAlpha(pendingAlpha);
    if (activeTxid) load(activeTxid, pendingAlpha);
  };

  const loadMempoolSample = async () => {
    setLoading(true);
    setError(null);
    try {
      const { txid } = await fetchMempoolSample();
      await load(txid, committedAlpha);
    } catch {
      setError('Could not fetch a live mempool transaction right now.');
      setLoading(false);
    }
  };

  const liveProbability = latest?.probability ?? summary?.probability ?? 0;
  const liveConfirmations = latest?.confirmations ?? summary?.confirmations ?? 0;
  const liveElapsed = latest?.elapsed_time ?? 0;

  return (
    <div className="app">
      <header className="header">
        <h1>
          <span className="accent">₿</span> Bitcoin Double-Spend Risk
        </h1>
        <p className="subtitle">
          Estimate the probability a transaction could still be reversed, in real time.
        </p>
      </header>

      <section className="controls">
        <SearchBar onSearch={handleSearch} disabled={loading} />

        <div className="alpha-control">
          <label>
            Attacker hash power (α): <strong>{pendingAlpha.toFixed(2)}</strong>
          </label>
          <input
            type="range"
            min="0.01"
            max="0.49"
            step="0.01"
            value={pendingAlpha}
            onChange={(e) => setPendingAlpha(parseFloat(e.target.value))}
            onPointerUp={commitAlpha}
            onKeyUp={commitAlpha}
          />
        </div>

        <SampleList samples={samples} onSelect={handleSearch} />

        {dataSource === 'esplora' && (
          <div className="mempool-cta">
            <button onClick={loadMempoolSample} disabled={loading}>
              Load a live mempool transaction
            </button>
            <span className="samples-label">
              Real unconfirmed transaction from the network — watch its double-spend risk in real time.
            </span>
          </div>
        )}
      </section>

      {loading && <p className="notice">Loading…</p>}
      {error && <p className="error notice">{error}</p>}

      {summary && (
        <main className="results">
          <div className="top-grid">
            <StatsPanel
              probability={liveProbability}
              confirmations={liveConfirmations}
              elapsed={liveElapsed}
              isCoinbase={summary.is_coinbase}
              status={status}
            />
            <TransactionDetails tx={summary} />
          </div>

          {summary.is_coinbase ? (
            <p className="notice">
              This is a coinbase (block-reward) transaction. It has no inputs to double-spend, so no
              risk is computed.
            </p>
          ) : (
            <div className="charts">
              <ProbabilityChart points={points} title="Live probability (streaming)" color="#f7931a" />
              {history && (
                <>
                  <ProbabilityChart
                    points={history.first_5h.points}
                    title="Modeled decay — first 5 hours"
                    color="#4ea8de"
                  />
                  <ProbabilityChart
                    points={history.full_graph.points}
                    title="Modeled decay — full history"
                    color="#57cc99"
                  />
                </>
              )}
            </div>
          )}
        </main>
      )}

      <footer className="footer">
        <p>
          Portfolio demo. The probability model is real; sample transactions are simulated so the app
          runs without a Bitcoin node. Point it at a live node by setting the API's data source to
          <code> rpc</code>.
        </p>
      </footer>
    </div>
  );
}
