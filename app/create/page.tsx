"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/app/wallet-context";
import { WalletButton } from "@/components/wallet-button";
import { useCreateCampaign } from "@/hooks/use-send-tx";
import { toError, UserRejectedError, InsufficientBalanceError } from "@/lib/errors";

const EXPLORER = "https://stellar.expert/explorer/testnet/tx";

export default function CreatePage() {
  const { address } = useWallet();
  const router = useRouter();
  const qc = useQueryClient();
  const create = useCreateCampaign(address);

  const [title, setTitle] = useState("");
  const [charity, setCharity] = useState("");
  const [matchCap, setMatchCap] = useState("");
  const [days, setDays] = useState("7");
  const [lastHash, setLastHash] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!address) return;
    const deadlineTs = Math.floor(Date.now() / 1000) + Number(days) * 86_400;
    try {
      const r = await create.mutateAsync({
        title: title.trim(),
        charity: charity.trim(),
        matchCapXlm: matchCap,
        deadlineTs,
      });
      setLastHash(r.contractHash);
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      router.push(`/campaign/${r.campaignId}`);
    } catch { /* shown below */ }
  }

  const err = create.error ? toError(create.error) : null;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="flex items-center justify-between gap-3 pb-4">
          <Link
            href="/"
            className="text-sm text-muted hover:text-fg"
          >
            ← Back
          </Link>
          <WalletButton />
        </header>

        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          <span className="bg-gradient-to-r from-[#ec4899] to-[#7c3aed] bg-clip-text text-transparent">
            Create Campaign
          </span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          You become the sponsor. Your match cap is escrowed upfront.
        </p>

        {!address && (
          <div className="bubble mt-6 bg-gradient-to-br from-[#fce7f3] to-[#ddd6fe] p-6 text-center">
            <p className="text-sm font-semibold">Connect a wallet to continue</p>
            <p className="mt-1 text-xs text-muted">You need XLM to escrow the match cap.</p>
          </div>
        )}

        {address && (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="bubble p-5 sm:p-6 space-y-4">
              <Field label="Campaign Title">
                <input
                  type="text"
                  required
                  maxLength={64}
                  placeholder="e.g. School Lunches Fund"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input-bubble w-full px-4 py-2.5 text-sm"
                />
              </Field>

              <Field label="Charity Stellar Address" hint="The G... address that receives funds when you close the campaign.">
                <input
                  type="text"
                  required
                  pattern="G[A-Z0-9]{55}"
                  placeholder="GABC..."
                  value={charity}
                  onChange={(e) => setCharity(e.target.value)}
                  className="input-bubble w-full px-4 py-2.5 font-mono text-sm"
                />
              </Field>

              <Field label="Your Match Cap (XLM)" hint="This amount is transferred from your wallet to the contract now.">
                <input
                  type="number"
                  required
                  step="0.0000001"
                  min="0.0000001"
                  placeholder="100"
                  value={matchCap}
                  onChange={(e) => setMatchCap(e.target.value)}
                  className="input-bubble w-full px-4 py-2.5 font-mono text-sm"
                />
              </Field>

              <Field label="Deadline" hint="Days from now. After this, if you haven&apos;t closed, donors can refund.">
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    required
                    min="1"
                    max="365"
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    className="input-bubble w-24 px-4 py-2.5 font-mono text-sm"
                  />
                  <span className="text-sm text-muted">days</span>
                </div>
              </Field>
            </div>

            <button
              type="submit"
              disabled={create.isPending}
              className="btn-bubble w-full py-3 text-sm font-semibold"
            >
              {create.isPending ? "Creating..." : "Create Campaign + Escrow Match"}
            </button>

            {err && (
              <div className="rounded-2xl bg-[var(--color-danger)]/10 p-4 text-sm text-danger">
                {err instanceof UserRejectedError
                  ? "You rejected the request in your wallet."
                  : err instanceof InsufficientBalanceError
                    ? "Not enough XLM to escrow the match cap."
                    : `Failed: ${err.message}`}
              </div>
            )}

            {lastHash && (
              <a
                href={`${EXPLORER}/${lastHash}`}
                target="_blank"
                rel="noreferrer"
                className="block text-center font-mono text-xs text-muted hover:text-fg"
              >
                tx · {lastHash.slice(0, 16)}...
              </a>
            )}
          </form>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-subtle">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}
