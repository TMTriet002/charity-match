"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/app/wallet-context";
import { useCampaign, useMyDonation } from "@/hooks/use-campaign";
import { useDonate, useClose, useRefund } from "@/hooks/use-send-tx";
import { stroopsToXlm } from "@/lib/soroban";
import { toError, UserRejectedError, InsufficientBalanceError } from "@/lib/errors";

const EXPLORER = "https://stellar.expert/explorer/testnet/tx";

function tlString(deadline: number): { label: string; over: boolean } {
  const diff = deadline - Math.floor(Date.now() / 1000);
  if (diff <= 0) return { label: "deadline passed", over: true };
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  if (days >= 1) return { label: `${days}d ${hours}h left`, over: false };
  if (hours >= 1) return { label: `${hours}h left`, over: false };
  const m = Math.max(1, Math.floor(diff / 60));
  return { label: `${m}m left`, over: false };
}

function shortAddr(a: string) {
  return `${a.slice(0, 4)}...${a.slice(-4)}`;
}

export function CampaignCard({ campaignId }: { campaignId: number }) {
  const { address } = useWallet();
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useCampaign(campaignId);
  const my = useMyDonation(campaignId, address);
  const donate = useDonate(address, campaignId);
  const close = useClose(address, campaignId);
  const refund = useRefund(address, campaignId);

  const [amount, setAmount] = useState("");
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [lastHash, setLastHash] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => clearInterval(t);
  }, []);

  if (isLoading) {
    return (
      <div className="bubble p-6">
        <div className="h-6 w-1/2 animate-pulse rounded-full bg-elevated" />
        <div className="mt-4 h-24 animate-pulse rounded-3xl bg-elevated" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="bubble border-danger/40 p-6 text-sm text-danger">
        Could not load campaign #{campaignId}.
      </div>
    );
  }

  const tl = tlString(data.deadline);
  const isClosed = data.status === "Closed";
  const isOpen = !isClosed && !tl.over;
  const isRefunding = !isClosed && tl.over;
  const isSponsor = address && data.sponsor && address === data.sponsor;
  const myAmount = my.data?.donation ?? 0n;
  const myRefunded = my.data?.refunded ?? false;

  const total = data.donated + data.matched;
  const totalCap = data.matchCap * 2n;
  const totalPct = totalCap === 0n ? 0 : Number((total * 1000n) / totalCap) / 10;
  const donatedPct = totalCap === 0n ? 0 : Number((data.donated * 1000n) / totalCap) / 10;

  function bump(hash?: string) {
    if (hash) setLastHash(hash);
    qc.invalidateQueries({ queryKey: ["campaign"] });
    qc.invalidateQueries({ queryKey: ["campaigns"] });
    qc.invalidateQueries({ queryKey: ["my-donation"] });
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["balance", address] });
    refetch();
  }

  async function onDonate(e: FormEvent) {
    e.preventDefault();
    if (!address) return;
    try {
      const r = await donate.mutateAsync(amount);
      setAmount("");
      bump(r.contractHash);
    } catch { /* shown below */ }
  }
  async function onClose() {
    if (!address) return;
    try {
      const r = await close.mutateAsync();
      bump(r.contractHash);
    } catch { /* shown below */ }
  }
  async function onRefund() {
    if (!address) return;
    try {
      const r = await refund.mutateAsync();
      bump(r.contractHash);
    } catch { /* shown below */ }
  }

  const err = donate.error ?? close.error ?? refund.error
    ? toError(donate.error ?? close.error ?? refund.error)
    : null;
  const pending = donate.isPending || close.isPending || refund.isPending;

  return (
    <article className="bubble p-6 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-subtle">Campaign #{campaignId}</p>
          <h2 className="mt-1 truncate text-xl font-semibold leading-tight sm:text-2xl">
            {data.title || "(untitled)"}
          </h2>
          <p className="mt-1 text-xs text-muted">
            Charity {shortAddr(data.charity)} · Sponsor {shortAddr(data.sponsor)}
          </p>
        </div>
        <span
          className={`shrink-0 tag-pill ${
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

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-subtle font-semibold">
          <span>
            Sponsor&apos;s match remaining:{" "}
            <span className="font-mono text-fg">{stroopsToXlm(data.matchCap - data.matched)} XLM</span>
          </span>
        </div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-mono font-semibold">
            {stroopsToXlm(total)}{" "}
            <span className="text-muted">XLM raised</span>
          </span>
          <span className="text-xs text-muted">
            {data.donors} donor{data.donors === 1 ? "" : "s"} · {tl.label}
          </span>
        </div>
        <div className="relative mt-2 h-3 w-full overflow-hidden rounded-full bg-elevated">
          <div
            className="absolute left-0 top-0 h-full bg-[var(--color-accent)]"
            style={{ width: `${Math.min(100, donatedPct)}%` }}
          />
          <div
            className="absolute top-0 h-full bg-[var(--color-accent-2)]"
            style={{
              left: `${Math.min(100, donatedPct)}%`,
              width: `${Math.min(100, totalPct - donatedPct)}%`,
            }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted">
          <span>
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-accent)] align-middle" />{" "}
            Donated {stroopsToXlm(data.donated)}
          </span>
          <span>
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-accent-2)] align-middle" />{" "}
            Matched {stroopsToXlm(data.matched)} / {stroopsToXlm(data.matchCap)}
          </span>
        </div>
      </div>

      {address && myAmount > 0n && (
        <div className="mt-5 rounded-2xl bg-[var(--color-elevated)] p-3 text-xs">
          You donated <span className="font-mono">{stroopsToXlm(myAmount)} XLM</span>
          {myRefunded && <span className="ml-2 text-muted">(refunded)</span>}
        </div>
      )}

      <div className="mt-6 border-t border-border pt-5">
        {!address && (
          <p className="text-sm text-muted">Connect a wallet to donate, close, or refund.</p>
        )}

        {address && isOpen && (
          <form onSubmit={onDonate} className="flex flex-wrap items-center gap-3">
            <input
              type="number"
              step="0.0000001"
              min="0.0000001"
              required
              placeholder="Amount in XLM"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input-bubble flex-1 px-4 py-2.5 font-mono text-sm"
            />
            <button
              type="submit"
              disabled={pending || !amount}
              className="btn-bubble px-6 py-2.5 text-sm"
            >
              {donate.isPending ? "Donating..." : "Donate"}
            </button>
          </form>
        )}

        {address && isOpen && isSponsor && (
          <button
            onClick={onClose}
            disabled={pending}
            className="btn-soft mt-3 w-full px-4 py-2.5 text-sm"
          >
            {close.isPending
              ? "Closing..."
              : `Close + Send ${stroopsToXlm(total)} XLM to Charity`}
          </button>
        )}

        {address && isRefunding && myAmount > 0n && !myRefunded && (
          <button
            onClick={onRefund}
            disabled={pending}
            className="btn-soft w-full px-4 py-2.5 text-sm"
          >
            {refund.isPending ? "Refunding..." : `Refund ${stroopsToXlm(myAmount)} XLM`}
          </button>
        )}

        {address && isRefunding && (myAmount === 0n || myRefunded) && (
          <p className="text-sm text-muted">
            {myRefunded
              ? "You already refunded."
              : "Deadline passed. Donors can now refund their pledges."}
          </p>
        )}

        {address && isClosed && (
          <p className="text-sm text-muted">
            Campaign closed. Charity received {stroopsToXlm(total)} XLM.
          </p>
        )}

        {lastHash && (
          <a
            href={`${EXPLORER}/${lastHash}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block break-all font-mono text-xs text-muted hover:text-fg"
          >
            tx · {lastHash.slice(0, 16)}...
          </a>
        )}

        {err && (
          <div className="mt-3 rounded-2xl bg-[var(--color-danger)]/10 p-3 text-xs text-danger">
            {err instanceof UserRejectedError
              ? "You rejected the request in your wallet."
              : err instanceof InsufficientBalanceError
                ? "Not enough XLM to cover this transaction."
                : `Failed: ${err.message}`}
          </div>
        )}
      </div>
    </article>
  );
}
