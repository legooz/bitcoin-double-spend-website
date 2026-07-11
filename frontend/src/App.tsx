import { useCallback, useEffect, useState } from 'react';

import {
  ApiError,
  fetchHealth,
  fetchHistory,
  fetchLargestPool,
  fetchMempoolSample,
  fetchSamples,
  fetchTransaction,
} from './api/client';
import type { LargestPool } from './api/client';
import { AlphaControl } from './components/AlphaControl';
import { Explainer } from './components/Explainer';
import { ProbabilityCard } from './components/ProbabilityCard';
import { ProbabilityChart } from './components/ProbabilityChart';
import { SearchBar } from './components/SearchBar';
import { SummaryPanel } from './components/SummaryPanel';
import { TransactionHeader } from './components/TransactionHeader';
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
  const [searchResetKey, setSearchResetKey] = useState(0);
  const [largestPool, setLargestPool] = useState<LargestPool | null>(null);

  const canStream = summary != null && !summary.is_coinbase;
  const { latest, points, status } = useProbabilityStream(activeTxid, committedAlpha, canStream);

  useEffect(() => {
    fetchSamples().then(setSamples).catch(() => undefined);
    fetchHealth().then((h) => setDataSource(h.data_source)).catch(() => undefined);
    fetchLargestPool().then(setLargestPool).catch(() => setLargestPool(null));
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
      // Reflect the loaded transaction in the URL so it's shareable / refresh-safe.
      const params = new URLSearchParams({ txid, alpha: alpha.toFixed(2) });
      window.history.replaceState(null, '', `?${params.toString()}`);
      if (!result.is_coinbase) {
        fetchHistory(txid, alpha)
          .then(setHistory)
          .catch(() => setHistory(null));
      }
    } catch (err) {
      setActiveTxid(null);
      setError(
        err instanceof ApiError && err.status === 404
          ? 'Transaction not found. In demo mode only the sample transactions resolve; switch the API to esplora mode for real transaction ids.'
          : err instanceof ApiError
            ? err.message
            : 'Failed to load transaction.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Deep-link: on first render, load a transaction from ?txid=&alpha= if present.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const txid = params.get('txid');
    if (txid && /^[0-9a-fA-F]{64}$/.test(txid)) {
      const parsed = parseFloat(params.get('alpha') ?? '');
      const alpha = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0.01), 0.49) : committedAlpha;
      setCommittedAlpha(alpha);
      setPendingAlpha(alpha);
      load(txid.toLowerCase(), alpha);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const handleSearch = (txid: string) => load(txid, committedAlpha);

  const commitAlpha = () => {
    setCommittedAlpha(pendingAlpha);
    if (activeTxid) load(activeTxid, pendingAlpha);
  };

  const applyAlpha = (value: number) => {
    const clamped = Math.min(Math.max(value, 0.01), 0.49);
    setPendingAlpha(clamped);
    setCommittedAlpha(clamped);
    if (activeTxid) load(activeTxid, clamped);
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

  const resetToHome = () => {
    setSummary(null);
    setActiveTxid(null);
    setHistory(null);
    setError(null);
    setLoading(false);
    setSearchResetKey((key) => key + 1); // remount SearchBar to clear its input
    window.history.replaceState(null, '', window.location.pathname);
  };

  const liveProbability = latest?.probability ?? summary?.probability ?? 0;
  const liveConfirmations = latest?.confirmations ?? summary?.confirmations ?? 0;
  const liveElapsed = latest?.elapsed_time ?? 0;

  return (
    <div className="app">
      <header
        className="hero-brand clickable"
        role="button"
        tabIndex={0}
        aria-label="Return to home"
        onClick={resetToHome}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            resetToHome();
          }
        }}
      >
        <div className="hero-logo-circle">
          <img src="/bitcoin-logo.png" alt="Bitcoin logo" className="hero-logo" />
        </div>
        <div>
          <h1 className="hero-title">
            <span className="accent">Double Spend</span> Analyzer
          </h1>
          <p className="hero-subtitle">Analyze Bitcoin transactions for double-spend attack probability</p>
        </div>
      </header>

      <SearchBar key={searchResetKey} onSearch={handleSearch} disabled={loading} />

      {samples.length > 0 && (
        <div className="controls-extra">
          <span className="samples-label">Try a sample:</span>
          {samples.map((sample) => (
            <button key={sample.txid} className="sample-chip" onClick={() => handleSearch(sample.txid)}>
              {sample.label}
            </button>
          ))}
        </div>
      )}

      {dataSource === 'esplora' && (
        <div className="mempool-cta">
          <button className="hero-search-button" onClick={loadMempoolSample} disabled={loading}>
            Load a live mempool transaction
          </button>
          <span className="samples-label">
            Real unconfirmed transaction from the network. Watch its double-spend risk in real time.
          </span>
        </div>
      )}

      {loading && <p className="notice">Loading…</p>}
      {error && <p className="notice error">{error}</p>}

      {!loading && !summary && <Explainer />}

      {summary && (
        <main className="results">
          <TransactionHeader txid={summary.txid} explorerLink={dataSource === 'esplora'} />

          <AlphaControl
            pendingAlpha={pendingAlpha}
            onChange={setPendingAlpha}
            onCommit={commitAlpha}
            onApply={applyAlpha}
            largestPool={largestPool}
          />

          <ProbabilityCard
            probability={liveProbability}
            confirmations={liveConfirmations}
            elapsed={liveElapsed}
            isCoinbase={summary.is_coinbase}
            status={status}
          />

          {summary.is_coinbase ? (
            <p className="notice">
              Coinbase (block-reward) transaction: it has no inputs to double-spend, so no risk is computed.
            </p>
          ) : (
            <section className="graphs-section">
              <h2 className="graphs-title">Probability Graphs</h2>
              <p className="graphs-subtitle">
                α {committedAlpha.toFixed(2)} · {history ? 'modeled decay + live stream' : 'live stream'}
              </p>
              <div className="graph-grid">
                <div className="graph-card graph-card-wide">
                  <div className="graph-card-title">Live Probability</div>
                  <div className="graph-card-subtitle">Incoming websocket updates over elapsed time.</div>
                  <div className="graph-surface">
                    <ProbabilityChart points={points} color="#e89a3d" height={320} />
                  </div>
                </div>
                {history && (
                  <>
                    <div className="graph-card">
                      <div className="graph-card-title">First 5 Hours</div>
                      <div className="graph-card-subtitle">Modeled probability during the first five hours.</div>
                      <div className="graph-surface">
                        <ProbabilityChart points={history.first_5h.points} color="#3b82f6" height={320} />
                      </div>
                    </div>
                    <div className="graph-card">
                      <div className="graph-card-title">Full History</div>
                      <div className="graph-card-subtitle">Modeled decay across the transaction's life.</div>
                      <div className="graph-surface">
                        <ProbabilityChart points={history.full_graph.points} color="#22c55e" height={320} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          <SummaryPanel tx={summary} liveConfirmations={liveConfirmations} />
        </main>
      )}

      <footer className="footer">
        <p className="footer-refs">
          Based on{' '}
          <a href="https://bitcoin.org/bitcoin.pdf" target="_blank" rel="noopener noreferrer">
            Nakamoto (2008)
          </a>{' '}
          and{' '}
          <a href="https://eprint.iacr.org/2018/040" target="_blank" rel="noopener noreferrer">
            Neumayer, Varia &amp; Eyal (2018)
          </a>
          .
        </p>
        <p>
          Portfolio demo. The probability model is real; in demo mode sample transactions are simulated so
          the app runs without a Bitcoin node. Set the API's <code>DSCAP_DATA_SOURCE</code> to{' '}
          <code>esplora</code> for live mainnet data.
        </p>
      </footer>
    </div>
  );
}
