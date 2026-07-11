// Well-known real mainnet transactions, offered as one-click examples in
// real-data (esplora) mode. All are confirmed and non-coinbase, so they show
// full transaction details and a modeled decay history.
export interface FamousTransaction {
  txid: string;
  label: string;
}

export const FAMOUS_TRANSACTIONS: FamousTransaction[] = [
  {
    txid: 'cca7507897abc89628f450e8b1e0c6fca4ec3f7b34cccf55f3f531c659ff4d79',
    label: 'Pizza transaction (10,000 BTC)',
  },
  {
    txid: 'f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16',
    label: 'First Bitcoin transaction',
  },
  {
    txid: 'ec93df186ca1bbaa2a505234d5cd7d8be01b7a6166be599133fcb5fa8907db98',
    label: 'Large transaction (296 inputs)',
  },
];
