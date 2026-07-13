import { useState } from 'react';

const BITCOIN_ADDRESS = '3GBCopGGDn2ebGtgVEnb3NsXaCUi417xd8'; // mainnet (on-chain) only; copied when "Send Bitcoin" is clicked

// Support / credit row shown in the top-right of the page.
export function SupportLinks() {
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (!BITCOIN_ADDRESS) return;
    try {
      await navigator.clipboard.writeText(BITCOIN_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable (e.g. insecure context); ignore.
    }
  };

  return (
    <div className="support-links">
      <button
        type="button"
        className="support-btn support-btc"
        onClick={copyAddress}
        title={BITCOIN_ADDRESS ? 'Copy my Bitcoin address (on-chain / mainnet only)' : 'Address coming soon'}
      >
        ₿ {copied ? 'Address copied' : 'Send Bitcoin'}
      </button>
    </div>
  );
}
