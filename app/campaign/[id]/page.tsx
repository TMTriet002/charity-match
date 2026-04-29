"use client";

import { use } from "react";
import Link from "next/link";
import { WalletButton } from "@/components/wallet-button";
import { CampaignCard } from "@/components/campaign-card";
import { BalanceCard } from "@/components/balance-card";
import { EventFeed } from "@/components/event-feed";
import { useWallet } from "@/app/wallet-context";

export default function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const campaignId = Number(id);
  const { address } = useWallet();

  if (isNaN(campaignId) || campaignId < 0) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-2xl px-4 py-12 text-center">
          <p className="text-lg font-semibold">Invalid campaign ID</p>
          <Link href="/" className="mt-4 inline-block text-sm text-muted hover:text-fg">
            ← Back to campaigns
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="flex items-center justify-between gap-3 pb-4">
          <Link href="/" className="text-sm text-muted hover:text-fg">
            ← All Campaigns
          </Link>
          <WalletButton />
        </header>

        <div className="mt-2">
          <CampaignCard campaignId={campaignId} />
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 sm:gap-6">
          <section className="bubble bg-gradient-to-br from-[#fce7f3]/40 to-[#ddd6fe]/40 p-5 sm:p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Your Wallet
            </div>
            {address ? (
              <div className="mt-3">
                <BalanceCard />
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">
                Connect to see your balance and donation status.
              </p>
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
    </main>
  );
}
