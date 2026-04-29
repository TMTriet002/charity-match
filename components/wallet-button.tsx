"use client";

import { useWallet } from "@/app/wallet-context";

function shorten(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export function WalletButton() {
  const { address, connect, disconnect } = useWallet();

  if (address) {
    return (
      <button
        onClick={disconnect}
        title="Click to disconnect"
        className="btn-soft shrink-0 px-4 py-2 text-xs"
      >
        <span className="font-mono">{shorten(address)}</span>
        <span className="ml-1 hidden text-muted sm:inline">· Disconnect</span>
      </button>
    );
  }

  return (
    <button onClick={connect} className="btn-bubble shrink-0 px-5 py-2.5 text-sm">
      Connect Wallet
    </button>
  );
}
