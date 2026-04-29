"use client";

import Link from "next/link";
import { useWallet } from "@/app/wallet-context";
import { useAllCampaigns, type CampaignInfo } from "@/hooks/use-campaign";
import { stroopsToXlm } from "@/lib/soroban";

function tlLabel(deadline: number): { label: string; over: boolean } {
  const diff = deadline - Math.floor(Date.now() / 1000);
  if (diff <= 0) return { label: "expired", over: true };
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  if (days >= 1) return { label: `${days}d ${hours}h`, over: false };
  if (hours >= 1) return { label: `${hours}h`, over: false };
  return { label: `${Math.max(1, Math.floor(diff / 60))}m`, over: false };
}

function CampaignRow({ c }: { c: CampaignInfo }) {
  const isClosed = c.status === "Closed";
  const tl = tlLabel(c.deadline);
  const isRefunding = !isClosed && tl.over;
  const total = c.donated + c.matched;
  const totalCap = c.matchCap * 2n;
  const pct = totalCap === 0n ? 0 : Math.min(100, Number((total * 100n) / totalCap));
  const donatedPct = totalCap === 0n ? 0 : Math.min(100, Number((c.donated * 100n) / totalCap));

  return (
    <Link href={`/campaign/${c.id}`} className="block group">
      <article className="bubble p-5 transition-shadow group-hover:shadow-lg sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-subtle">
              #{c.id}
            </p>
            <h3 className="mt-0.5 truncate text-base font-semibold leading-snug">
              {c.title || "(untitled)"}
            </h3>
          </div>
          <span
            className={`shrink-0 tag-pill text-[10px] ${
              isClosed
                ? "bg-elevated text-muted"
                : isRefunding
                  ? "bg-[var(--color-danger)]/10 text-danger"
                  : "bg-gradient-to-r from-[#ec4899]/15 to-[#7c3aed]/15 text-fg"
            }`}
          >
            {isClosed ? "Closed" : isRefunding ? "Refunding" : "Open"}
          </span>
        </div>

        <div className="mt-3">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-elevated">
            <div
              className="absolute left-0 top-0 h-full bg-[var(--color-accent)]"
              style={{ width: `${donatedPct}%` }}
            />
            <div
              className="absolute top-0 h-full bg-[var(--color-accent-2)]"
              style={{ left: `${donatedPct}%`, width: `${pct - donatedPct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted">
            <span>
              <span className="font-mono font-semibold text-fg">{stroopsToXlm(total)}</span>{" "}
              XLM raised · {c.donors} donor{c.donors === 1 ? "" : "s"}
            </span>
            <span>{tl.label}</span>
          </div>
        </div>

        <div className="mt-2 text-xs text-muted">
          Match cap: <span className="font-mono">{stroopsToXlm(c.matchCap)} XLM</span>
          {" · "}
          Remaining:{" "}
          <span className="font-mono">{stroopsToXlm(c.matchCap - c.matched)} XLM</span>
        </div>
      </article>
    </Link>
  );
}

export function Dashboard() {
  const { address, connect } = useWallet();
  const { data: campaigns, isLoading, isError } = useAllCampaigns();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Campaigns</h2>
        {address ? (
          <Link href="/create" className="btn-bubble px-4 py-2 text-sm">
            + Create
          </Link>
        ) : (
          <button onClick={connect} className="btn-soft px-4 py-2 text-sm">
            Connect to Create
          </button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bubble h-28 animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="bubble p-6 text-sm text-danger">
          Could not load campaigns. Check <code>NEXT_PUBLIC_MAIN_CONTRACT_ID</code>.
        </div>
      )}

      {!isLoading && !isError && (!campaigns || campaigns.length === 0) && (
        <div className="bubble bg-gradient-to-br from-[#fce7f3]/40 to-[#ddd6fe]/40 p-8 text-center">
          <p className="text-base font-semibold">No campaigns yet</p>
          <p className="mt-1 text-sm text-muted">Be the first to create a matching campaign.</p>
          {address ? (
            <Link href="/create" className="btn-bubble mt-4 inline-block px-6 py-2.5 text-sm">
              Create First Campaign
            </Link>
          ) : (
            <button onClick={connect} className="btn-bubble mt-4 px-6 py-2.5 text-sm">
              Connect Wallet
            </button>
          )}
        </div>
      )}

      {campaigns && campaigns.length > 0 && (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <CampaignRow key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
