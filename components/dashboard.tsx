"use client";

import { useWallet } from "@/app/wallet-context";
import { BalanceCard } from "./balance-card";
import { CampaignCard } from "./campaign-card";
import { EventFeed } from "./event-feed";

export function Dashboard() {
  const { address, connect } = useWallet();

  return (
    <div className="space-y-8">
      <div>
        <CampaignCard />
        {!address && (
          <div className="mt-5">
            <ConnectCta onConnect={connect} />
          </div>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
        <section className="bubble bg-gradient-to-br from-[#fce7f3]/40 to-[#ddd6fe]/40 p-5 sm:p-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Your Wallet
          </div>
          {address ? (
            <div className="mt-3"><BalanceCard /></div>
          ) : (
            <p className="mt-3 text-sm text-muted">Connect to see your balance and donation history.</p>
          )}
        </section>

        <section className="bubble bg-white/70 p-5 sm:p-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Live Activity
          </div>
          <div className="mt-3">
            <EventFeed />
          </div>
        </section>
      </div>
    </div>
  );
}

function ConnectCta({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="bubble bg-gradient-to-br from-[#fce7f3] to-[#ddd6fe] p-6 text-center">
      <h3 className="text-lg font-semibold">Connect To Give</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">
        Use Freighter, xBull, Albedo, or Lobstr on Stellar Testnet. Friendbot
        funds new accounts.
      </p>
      <button
        onClick={onConnect}
        className="btn-bubble mt-4 px-5 py-2.5 text-sm"
      >
        Connect Wallet
      </button>
    </div>
  );
}
