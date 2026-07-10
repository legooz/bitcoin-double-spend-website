// TypeScript mirrors of the backend's Pydantic models (app/models.py).
// Keep these in sync with the API contract.

export interface TransactionInput {
  address: string | null;
  value: number | null;
}

export interface TransactionOutput {
  value: number;
  addresses: (string | null)[];
}

export interface TransactionSummary {
  txid: string;
  confirmations: number;
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
  blockhash: string;
  time: number;
  blocktime: number;
  alpha: number;
  probability: number;
  is_coinbase: boolean;
  label: string | null;
}

export interface ProbabilityUpdate {
  confirmations: number;
  probability: number;
  elapsed_time: number;
}

export interface ProbabilityPoint {
  elapsed_seconds: number;
  probability: number;
}

export interface HistoryView {
  points: ProbabilityPoint[];
}

export interface HistoryResponse {
  txid: string;
  included_block_height: number;
  included_block_time: number;
  alpha: number;
  full_graph: HistoryView;
  first_5h: HistoryView;
}

export interface SampleTransaction {
  txid: string;
  label: string;
}
