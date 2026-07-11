// Well-known real mainnet transactions, offered as one-click examples in
// real-data (esplora) mode. All are confirmed and non-coinbase, so they show
// full transaction details and a modeled decay history.
export interface FamousTransaction {
  txid: string;
  label: string;
}

// Confirmation-speed scenarios: real early-mainnet transactions chosen for how
// fast the blocks after them arrived, so the First 5 Hours graph shows the
// contrast. "Slow" is the coinbase of block 16589 (June 2009), when the tiny
// network mined blocks hours apart, so its risk stays elevated for hours; the
// other two confirm promptly and their risk collapses.
export const SCENARIO_TRANSACTIONS: FamousTransaction[] = [
  {
    txid: '17ef5d6fe79b78b34d818db0d4681c9f97582b87209198b6e7f510802cfa4a0e',
    label: 'Slow to confirm (2009)',
  },
  {
    txid: '045795627ca29ec72a94c23a65ee775ea1949d60b6fba0938b75e1cfe1e6643e',
    label: 'Normal confirmations',
  },
  {
    txid: '73beab87e8084a17051bb9cd60cecf92abf8a0c3b7511a22ce86148b2b947e6b',
    label: 'Fast confirmations',
  },
];

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
