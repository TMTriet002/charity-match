"use client";

import { useWallet } from "@/app/wallet-context";
import { useBalance } from "@/hooks/use-balance";

function formatXlm(raw: string) {
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return raw;
  return n.toFixed(4).replace(/\.?0+$/, "");
}

export function BalanceCard() {
  const { address } = useWallet();
  const { data, isLoading, isError } = useBalance(address);

  if (!address) return null;

  return (
    <div className="bubble p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-subtle">
        Your balance
      </div>
      <div className="mt-1 font-mono text-2xl font-semibold">
        {isLoading ? (
          <span className="inline-block h-7 w-32 animate-pulse rounded-full bg-elevated" />
        ) : isError ? (
          <span className="text-base font-normal text-danger">
            Failed to load
          </span>
        ) : (
          <>
            {formatXlm(data ?? "0")}
            <span className="ml-2 text-base font-normal text-muted">XLM</span>
          </>
        )}
      </div>
    </div>
  );
}
