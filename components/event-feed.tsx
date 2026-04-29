"use client";

import { useContractEvents } from "@/hooks/use-contract-events";
import type { ContractEvent } from "@/lib/events";
import { stroopsToXlm } from "@/lib/soroban";

function shortAddr(a: string) {
  return `${a.slice(0, 4)}...${a.slice(-4)}`;
}

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const s = Math.floor(d / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export function EventFeed() {
  const { data, isLoading, isError } = useContractEvents();

  return (
    <div className="bubble p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-subtle">
          Activity
        </div>
        <span className="flex items-center gap-1.5 text-[10px] text-muted">
          <span className="text-[10px] font-semibold text-[var(--color-accent)]">matching now</span>
        </span>
      </div>

      {isLoading ? (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-2xl bg-elevated" />
          ))}
        </div>
      ) : isError ? (
        <div className="mt-3 text-sm text-danger">Failed to load events</div>
      ) : !data || data.length === 0 ? (
        <div className="mt-3 text-sm text-subtle">
          No donations yet. Be the first.
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {data.map((e) => (
            <Row key={e.id} e={e} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({ e }: { e: ContractEvent }) {
  const tx = `https://stellar.expert/explorer/testnet/tx/${e.txHash}`;

  if (e.kind === "donate") {
    return (
      <li className="rounded-2xl border border-border p-3 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <span>
            <span className="font-mono text-xs">{shortAddr(e.donor)}</span>{" "}
            donated{" "}
            <span className="font-semibold">
              {stroopsToXlm(e.amount)} XLM
            </span>
          </span>
          <a
            href={tx}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted hover:text-fg"
          >
            {timeAgo(e.ledgerClosedAt)}
          </a>
        </div>
        {e.matched > 0n && (
          <div className="mt-1 text-xs text-[var(--color-accent-2)]">
            sponsor matched +{stroopsToXlm(e.matched)} XLM
          </div>
        )}
      </li>
    );
  }

  if (e.kind === "close") {
    return (
      <li className="rounded-2xl border border-border bg-[var(--color-elevated)] p-3 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <span>
            campaign closed,{" "}
            <span className="font-mono text-xs">{shortAddr(e.charity)}</span>{" "}
            received{" "}
            <span className="font-semibold">
              {stroopsToXlm(e.payout)} XLM
            </span>
          </span>
          <a
            href={tx}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted hover:text-fg"
          >
            {timeAgo(e.ledgerClosedAt)}
          </a>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-2xl border border-border p-3 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span>
          <span className="font-mono text-xs">{shortAddr(e.donor)}</span>{" "}
          refunded{" "}
          <span className="font-semibold">{stroopsToXlm(e.amount)} XLM</span>
        </span>
        <a
          href={tx}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted hover:text-fg"
        >
          {timeAgo(e.ledgerClosedAt)}
        </a>
      </div>
    </li>
  );
}
