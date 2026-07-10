// Manages the live-probability WebSocket for one transaction.
// Opens a connection when txid/alpha change, accumulates the streamed points,
// and cleans up on unmount or when the inputs change.

import { useEffect, useRef, useState } from 'react';

import { probabilityWebSocketUrl } from '../api/client';
import type { ProbabilityPoint, ProbabilityUpdate } from '../types';

export type StreamStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

interface StreamState {
  latest: ProbabilityUpdate | null;
  points: ProbabilityPoint[];
  status: StreamStatus;
}

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

    const ws = new WebSocket(probabilityWebSocketUrl(txid, alpha));

    ws.onopen = () => setStatus('open');
    ws.onmessage = (event) => {
      const update: ProbabilityUpdate = JSON.parse(event.data);
      setLatest(update);
      // Only append when the clock advanced, to keep the chart monotonic in x.
      if (update.elapsed_time > lastElapsed.current) {
        lastElapsed.current = update.elapsed_time;
        setPoints((prev) => [...prev, { elapsed_seconds: update.elapsed_time, probability: update.probability }]);
      }
    };
    ws.onerror = () => setStatus('error');
    ws.onclose = () => setStatus((prev) => (prev === 'error' ? prev : 'closed'));

    return () => ws.close();
  }, [txid, alpha, enabled]);

  return { latest, points, status };
}
