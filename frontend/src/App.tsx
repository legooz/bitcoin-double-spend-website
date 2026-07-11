import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ApiError,
  fetchConfirmedSample,
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
import { FAMOUS_TRANSACTIONS, SCENARIO_TRANSACTIONS } from './famousTransactions';
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
  const [backendReady, setBackendReady] = useState(false);
  const [backendWaking, setBackendWaking] = useState(false);
  const [connectFailed, setConnectFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  const canStream = summary != null;
  const { latest, points, status } = useProbabilityStream(activeTxid, committedAlpha, canStream);

  // Confirmation count the history graphs were last built for. Lets us refresh
  // the history in place when a new block arrives, without resetting the live
  // WebSocket. Reset in load() whenever a fresh transaction is opened.
  const lastHistoryConfs = useRef<number>(-1);

  // The largest-pool chip depends on a slow upstream (mempool.space) and the
  // free backend may still be warming, so a single failure must not drop the
  // chip for the whole session. Retry with backoff; a ref guards against
  // concurrent runs when both the init loop and the summary effect trigger it.
  const poolInFlight = useRef(false);
  const loadLargestPool = useCallback(async () => {
    if (poolInFlight.current) return;
    poolInFlight.current = true;
    try {
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          setLargestPool(await fetchLargestPool());
          return;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
    } finally {
      poolInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      // The free backend (Render) sleeps and can take ~30-50s to wake. Retry the
      // initial fetches so the UI fills in once it's up, without a manual reload.
      setConnectFailed(false);
      for (let attempt = 0; attempt < 40 && !cancelled; attempt++) {
        try {
          const health = await fetchHealth();
          if (cancelled) return;
          setDataSource(health.data_source);
          setBackendReady(true);
          setBackendWaking(false);
          fetchSamples().then(setSamples).catch(() => undefined);
          loadLargestPool();
          return;
        } catch {
          if (!cancelled) setBackendWaking(true);
          await new Promise((resolve) => setTimeout(resolve, 4000));
        }
      }
      // Budget exhausted without a response: stop the spinner and offer a retry
      // instead of spinning forever.
      if (!cancelled) {
        setBackendWaking(false);
        setConnectFailed(true);
      }
    };
    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  // If the pool chip never loaded (slow/cold upstream), try again once a
  // transaction is on screen, so the recommendation is present when it's needed.
  useEffect(() => {
    if (summary && !largestPool) loadLargestPool();
  }, [summary, largestPool, loadLargestPool]);

  // When the live stream reports a new confirmation (a block arrived), refresh
  // the history graphs in place and keep the summary's confirmation count
  // current. This deliberately does NOT touch the WebSocket, so the live graph
  // keeps its accumulated points instead of restarting.
  useEffect(() => {
    const confs = latest?.confirmations;
    if (confs == null || activeTxid == null) return;
    if (confs === lastHistoryConfs.current) return;
    const isFirstTick = lastHistoryConfs.current === -1;
    lastHistoryConfs.current = confs;
    setSummary((prev) => (prev && prev.confirmations !== confs ? { ...prev, confirmations: confs } : prev));
    // The first tick just echoes the loaded summary; load() already fetched history.
    if (isFirstTick) return;
    setHistoryLoading(true);
    fetchHistory(activeTxid, committedAlpha)
      .then(setHistory)
      .catch(() => undefined)
      .finally(() => setHistoryLoading(false));
  }, [latest?.confirmations, activeTxid, committedAlpha]);

  const load = useCallback(async (txid: string, alpha: number) => {
    setLoading(true);
    setError(null);
    setHistory(null);
    setSummary(null);
    lastHistoryConfs.current = -1;
    try {
      const result = await fetchTransaction(txid, alpha);
      setSummary(result);
      setActiveTxid(txid);
      // Reflect the loaded transaction in the URL so it's shareable / refresh-safe.
      const params = new URLSearchParams({ txid, alpha: alpha.toFixed(2) });
      window.history.replaceState(null, '', `?${params.toString()}`);
      // History is available for any confirmed transaction, coinbase included
      // (unconfirmed ones 404 and resolve to null).
      setHistoryLoading(true);
      fetchHistory(txid, alpha)
        .then(setHistory)
        .catch(() => setHistory(null))
        .finally(() => setHistoryLoading(false));
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

  const loadConfirmedSample = async () => {
    setLoading(true);
    setError(null);
    try {
      const { txid } = await fetchConfirmedSample();
      await load(txid, committedAlpha);
    } catch {
      setError('Could not fetch a recent confirmed transaction right now.');
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
  const liveEmptyMessage =
    status === 'connecting'
      ? 'Connecting to the live stream…'
      : status === 'error'
        ? 'Live connection unavailable.'
        : status === 'closed'
          ? 'No further live updates (the transaction may already be confirmed).'
          : 'Waiting for the first update…';
  // A confirmed transaction whose risk has already decayed to ~0 has nothing
  // live to show; dim the live graph and say so.
  const isSettled = summary != null && summary.blockhash !== '' && liveProbability < 1e-4;

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

      {(dataSource === 'esplora' || !backendReady) && (
        <div className="controls-extra">
          <span className="samples-label">Try one:</span>
          {[...SCENARIO_TRANSACTIONS, ...FAMOUS_TRANSACTIONS].map((tx) => (
            <button key={tx.txid} className="sample-chip" onClick={() => handleSearch(tx.txid)}>
              {tx.label}
            </button>
          ))}
        </div>
      )}

      {dataSource === 'esplora' && (
        <div className="mempool-cta">
          <button className="hero-search-button" onClick={loadMempoolSample} disabled={loading}>
            Load a live mempool transaction
          </button>
          <button className="hero-search-button" onClick={loadConfirmedSample} disabled={loading}>
            Load a recent confirmed transaction
          </button>
        </div>
      )}

      {backendWaking && !backendReady && (
        <div className="notice notice-connecting" role="status">
          <span className="spinner" aria-hidden="true" />
          <span>
            Waking the analyzer. The free server sleeps when idle, so the first load can take up to a minute.
          </span>
        </div>
      )}
      {connectFailed && !backendReady && (
        <p className="notice error">
          Couldn't reach the analyzer after retrying.{' '}
          <button className="preset-btn" onClick={() => setRetryKey((key) => key + 1)}>
            Retry
          </button>
        </p>
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

          {summary.is_coinbase && <p className="notice">Coinbase transaction.</p>}
          <section className="graphs-section">
            <h2 className="graphs-title">Probability Graphs</h2>
            <p className="graphs-subtitle">
              α {committedAlpha.toFixed(2)} · {history ? 'real block-time decay + live stream' : 'live stream'}
            </p>
            <div className="graph-grid">
              <div className="graph-card graph-card-wide">
                <div className="graph-card-title">Live Probability</div>
                <div className="graph-card-subtitle">Incoming websocket updates over elapsed time.</div>
                <div className="graph-surface">
                  <div className={isSettled ? 'graph-dim' : undefined}>
                    <ProbabilityChart points={points} color="#e89a3d" height={320} emptyMessage={liveEmptyMessage} />
                  </div>
                  {isSettled && (
                    <div className="graph-overlay">
                      Fully confirmed. Double-spend risk is effectively zero.
                    </div>
                  )}
                </div>
              </div>
              {historyLoading && (
                <div className="graph-card">
                  <div className="graph-card-title">Confirmation history</div>
                  <div className="graph-surface">
                    <div className="graph-empty">
                      Computing history… this can take a few seconds for older transactions.
                    </div>
                  </div>
                </div>
              )}
              {!historyLoading && !history && (
                <div className="graph-card">
                  <div className="graph-card-subtitle" style={{ margin: 0 }}>
                    Historical graphs appear once the transaction is confirmed.
                  </div>
                </div>
              )}
              {history && (
                <>
                  <div className="graph-card">
                    <div className="graph-card-title">First 5 Hours</div>
                    <div className="graph-card-subtitle">Probability during the first five hours, from real block times.</div>
                    <div className="graph-surface">
                      <ProbabilityChart points={history.first_5h.points} color="#3b82f6" height={320} />
                    </div>
                  </div>
                  <div className="graph-card">
                    <div className="graph-card-title">Full History</div>
                    <div className="graph-card-subtitle">Decay across the transaction's life, from real block times.</div>
                    <div className="graph-surface">
                      <ProbabilityChart points={history.full_graph.points} color="#22c55e" height={320} />
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          <SummaryPanel
            tx={summary}
            liveConfirmations={liveConfirmations}
            explorerLink={dataSource === 'esplora'}
          />
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
        <p className="footer-credit">
          This website was recreated by Lars Goozen, inspired by his capstone project with Caden Kane,
          Derek Hodgkins, and Zong Xiong, and advised by Sebastian Neumayer.
        </p>
        <p>
          {dataSource === 'demo'
            ? "Demo mode: the probability model is real, but sample transactions are simulated so the app runs without a Bitcoin node."
            : 'The probability model is real, and transactions are live Bitcoin mainnet data from the mempool.space API.'}
        </p>
      </footer>
    </div>
  );
}
