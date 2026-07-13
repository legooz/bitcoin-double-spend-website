// Typed HTTP + WebSocket client for the DSCap API.
// The base URL is injected at build time via Vite env vars so the same bundle
// can point at localhost in dev and the deployed API in production.

import type { HistoryResponse, SampleTransaction, TransactionSummary } from '../types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000').replace(/\/$/, '');

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new ApiError(response.status, await safeMessage(response));
  }
  return (await response.json()) as T;
}

async function safeMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body.detail ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export interface Health {
  status: string;
  data_source: string;
}

export function fetchHealth(): Promise<Health> {
  return getJson<Health>('/health');
}

export function fetchSamples(): Promise<SampleTransaction[]> {
  return getJson<SampleTransaction[]>('/samples');
}

export function fetchMempoolSample(): Promise<{ txid: string }> {
  return getJson<{ txid: string }>('/mempool/sample');
}

export function fetchConfirmedSample(): Promise<{ txid: string }> {
  return getJson<{ txid: string }>('/confirmed/sample');
}

export function fetchSettledSample(): Promise<{ txid: string }> {
  return getJson<{ txid: string }>('/settled/sample');
}

export interface LargestPool {
  name: string;
  share: number;
}

export function fetchLargestPool(): Promise<LargestPool> {
  return getJson<LargestPool>('/mining/largest-pool');
}

export function fetchTransaction(txid: string, alpha: number): Promise<TransactionSummary> {
  return getJson<TransactionSummary>(`/transaction/${txid}?alpha=${alpha}`);
}

export function fetchHistory(txid: string, alpha: number, lttbThreshold?: number): Promise<HistoryResponse> {
  const threshold = lttbThreshold ? `&lttb_threshold=${lttbThreshold}` : '';
  return getJson<HistoryResponse>(`/transaction/${txid}/history?alpha=${alpha}${threshold}`);
}

export function probabilityWebSocketUrl(txid: string, alpha: number): string {
  const wsBase = API_BASE.replace(/^http/, 'ws');
  return `${wsBase}/transaction/${txid}/ws?alpha=${alpha}`;
}
