"use client";

import { useGlobalStats } from "@/hooks/use-global-stats";
import { stroopsToXlm } from "@/lib/soroban";

const MAIN_CONTRACT_ID = process.env.NEXT_PUBLIC_MAIN_CONTRACT_ID;

export function StatsStrip() {
  const { data, isLoading } = useGlobalStats();

  return (
    <section className="mt-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Donated"
          value={data ? `${stroopsToXlm(data.donated)} XLM` : "..."}
          loading={isLoading}
        />
        <Stat
          label="Matched"
          value={data ? `${stroopsToXlm(data.matched)} XLM` : "..."}
          loading={isLoading}
        />
        <Stat
          label="Donors"
          value={data ? String(data.donors) : "..."}
          loading={isLoading}
        />
        <Stat
          label="Contract"
          value={
            MAIN_CONTRACT_ID
              ? `${MAIN_CONTRACT_ID.slice(0, 4)}...${MAIN_CONTRACT_ID.slice(-4)}`
              : "-"
          }
          href={
            MAIN_CONTRACT_ID
              ? `https://stellar.expert/explorer/testnet/contract/${MAIN_CONTRACT_ID}`
              : undefined
          }
          loading={false}
        />
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  loading,
  href,
}: {
  label: string;
  value: string;
  loading: boolean;
  href?: string;
}) {
  const inner = (
    <div className="bubble p-4">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-subtle">
        {label}
      </div>
      <div className="mt-1 font-mono text-base font-semibold">
        {loading ? (
          <span className="inline-block h-5 w-12 animate-pulse rounded-full bg-elevated" />
        ) : (
          value
        )}
      </div>
    </div>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="block">
        {inner}
      </a>
    );
  }
  return inner;
}
