import { useState } from 'react';

// Fill these in to activate the links. Leave a value as '' to keep the element
// as a styled placeholder: the button/link still renders, it just doesn't go
// anywhere (or copy anything) yet.
const BUY_ME_A_COFFEE_URL = ''; // e.g. 'https://www.buymeacoffee.com/larsgoozen'
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
      <a
        className="support-btn support-coffee"
        href={BUY_ME_A_COFFEE_URL || undefined}
        target="_blank"
        rel="noopener noreferrer"
        title={BUY_ME_A_COFFEE_URL ? 'Buy me a coffee' : 'Link coming soon'}
      >
        ☕ Buy me a coffee
      </a>
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
