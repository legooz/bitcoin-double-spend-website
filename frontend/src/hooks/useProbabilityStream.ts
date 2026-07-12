// Manages the live-probability WebSocket for one transaction.
// Opens a connection when txid/alpha change, accumulates the streamed points,
// and cleans up on unmount or when the inputs change. If the connection drops
// unexpectedly (idle/proxy timeout on a long-lived socket) it reconnects and
// keeps the accumulated points, so the live graph resumes instead of stopping.
//
// The accumulated points + latest update are also mirrored to localStorage so a
// page refresh that re-opens the SAME (txid, alpha) restores the curve and the
// live stream continues from where it left off instead of starting empty.

import { useEffect, useRef, useState } from 'react';

import { probabilityWebSocketUrl } from '../api/client';
import type { ProbabilityPoint, ProbabilityUpdate } from '../types';

export type StreamStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

interface StreamState {
  latest: ProbabilityUpdate | null;
  points: ProbabilityPoint[];
  status: StreamStatus;
}

// One snapshot of an in-progress stream, persisted so a refresh can resume it.
interface StoredSnapshot {
  txid: string;
  alpha: number;
  points: ProbabilityPoint[];
  latest: ProbabilityUpdate | null;
}

const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECTS = 20; // stop retrying if the backend is truly unreachable
const STORAGE_KEY = 'dscap:stream'; // single key; only the current stream is persisted
const SAVE_INTERVAL_MS = 5000; // periodic backup save; beforeunload covers refresh/close

// localStorage can be absent or throw (private mode, quota, disabled). These
// helpers must never let a storage failure break the live stream.
function loadSnapshot(): StoredSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSnapshot;
    if (!parsed || typeof parsed.txid !== 'string' || !Array.isArray(parsed.points)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveSnapshot(snapshot: StoredSnapshot): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore: storage unavailable or over quota. Persistence is best-effort.
  }
}

export function useProbabilityStream(txid: string | null, alpha: number, enabled: boolean): StreamState {
  const [latest, setLatest] = useState<ProbabilityUpdate | null>(null);
  const [points, setPoints] = useState<ProbabilityPoint[]>([]);
  const [status, setStatus] = useState<StreamStatus>('idle');
  const lastElapsed = useRef<number>(-1);

  // Refs mirror the current state/inputs so the throttled + beforeunload save
  // handlers always read the freshest values. Their effect closure is created
  // only when txid/alpha/enabled change, not on every streamed point.
  const pointsRef = useRef<ProbabilityPoint[]>(points);
  const latestRef = useRef<ProbabilityUpdate | null>(latest);
  const txidRef = useRef<string | null>(txid);
  const alphaRef = useRef<number>(alpha);

  useEffect(() => {
    pointsRef.current = points;
    latestRef.current = latest;
    txidRef.current = txid;
    alphaRef.current = alpha;
  });

  useEffect(() => {
    if (!txid || !enabled) {
      setStatus('idle');
      setLatest(null);
      setPoints([]);
      return;
    }

    // Resume from a persisted snapshot when the SAME tx+alpha is re-opened (e.g.
    // after a page refresh via the ?txid=&alpha= deep link). Otherwise start clean.
    const saved = loadSnapshot();
    const restored = saved && saved.txid === txid && saved.alpha === alpha ? saved : null;

    setStatus('connecting');
    if (restored) {
      setPoints(restored.points);
      setLatest(restored.latest ?? null);
      // Continue appending only for clock values beyond the last restored point.
      lastElapsed.current = restored.points.reduce(
        (max, p) => (p.elapsed_seconds > max ? p.elapsed_seconds : max),
        -1,
      );
    } else {
      setLatest(null);
      setPoints([]);
      lastElapsed.current = -1;
    }

    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let reconnects = 0;
    // The backend ends the stream once risk is negligible (the tx is effectively
    // settled). Track the last value so a real end can be told from a dropped
    // connection — we only reconnect for the latter.
    let lastProbability = 1;
    let sawMessage = false;

    const connect = () => {
      if (cancelled) return;
      ws = new WebSocket(probabilityWebSocketUrl(txid, alpha));

      ws.onopen = () => {
        if (!cancelled) setStatus('open');
      };
      ws.onmessage = (event) => {
        if (cancelled) return;
        const update: ProbabilityUpdate = JSON.parse(event.data);
        sawMessage = true;
        reconnects = 0; // a healthy connection resets the retry budget
        lastProbability = update.probability;
        setLatest(update);
        // Only append when the clock advanced, to keep the chart monotonic in x.
        if (update.elapsed_time > lastElapsed.current) {
          lastElapsed.current = update.elapsed_time;
          setPoints((prev) => [...prev, { elapsed_seconds: update.elapsed_time, probability: update.probability }]);
        }
      };
      ws.onclose = () => {
        if (cancelled) return;
        // Legitimate end: the stream reported negligible risk (settled tx).
        if (sawMessage && lastProbability <= 1e-6) {
          setStatus('closed');
          return;
        }
        // Unexpected drop (or never connected): resume with a short backoff.
        if (reconnects < MAX_RECONNECTS) {
          reconnects += 1;
          setStatus('connecting');
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        } else {
          setStatus('error');
        }
      };
    };

    connect();

    // Persist best-effort so a refresh can resume: on refresh/close via
    // beforeunload, plus a periodic backup interval. Reads refs so it always
    // captures the freshest accumulated points, not a stale closure value.
    const persist = () => {
      const currentTxid = txidRef.current;
      if (!currentTxid) return;
      saveSnapshot({
        txid: currentTxid,
        alpha: alphaRef.current,
        points: pointsRef.current,
        latest: latestRef.current,
      });
    };
    const saveTimer = setInterval(persist, SAVE_INTERVAL_MS);
    window.addEventListener('beforeunload', persist);

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(saveTimer);
      window.removeEventListener('beforeunload', persist);
      ws?.close();
    };
  }, [txid, alpha, enabled]);

  return { latest, points, status };
}
