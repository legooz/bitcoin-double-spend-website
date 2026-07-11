// Manages the live-probability WebSocket for one transaction.
// Opens a connection when txid/alpha change, accumulates the streamed points,
// and cleans up on unmount or when the inputs change. If the connection drops
// unexpectedly (idle/proxy timeout on a long-lived socket) it reconnects and
// keeps the accumulated points, so the live graph resumes instead of stopping.

import { useEffect, useRef, useState } from 'react';

import { probabilityWebSocketUrl } from '../api/client';
import type { ProbabilityPoint, ProbabilityUpdate } from '../types';

export type StreamStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

interface StreamState {
  latest: ProbabilityUpdate | null;
  points: ProbabilityPoint[];
  status: StreamStatus;
}

const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECTS = 20; // stop retrying if the backend is truly unreachable

export function useProbabilityStream(txid: string | null, alpha: number, enabled: boolean): StreamState {
  const [latest, setLatest] = useState<ProbabilityUpdate | null>(null);
  const [points, setPoints] = useState<ProbabilityPoint[]>([]);
  const [status, setStatus] = useState<StreamStatus>('idle');
  const lastElapsed = useRef<number>(-1);

  useEffect(() => {
    if (!txid || !enabled) {
      setStatus('idle');
      setLatest(null);
      setPoints([]);
      return;
    }

    setStatus('connecting');
    setLatest(null);
    setPoints([]);
    lastElapsed.current = -1;

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

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [txid, alpha, enabled]);

  return { latest, points, status };
}
