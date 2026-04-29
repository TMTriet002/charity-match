"use client";

import { useQuery } from "@tanstack/react-query";
import { addrArg, readContract } from "@/lib/soroban";

export type Status = "Open" | "Closed";

export type CampaignInfo = {
  charity: string;
  sponsor: string;
  title: string;
  matchCap: bigint;
  donated: bigint;
  matched: bigint;
  deadline: number;
  donors: number;
  status: Status;
};

function decodeStatus(raw: unknown): Status {
  if (raw === 1 || (typeof raw === "object" && raw && "tag" in raw && (raw as { tag: string }).tag === "Closed")) {
    return "Closed";
  }
  return "Open";
}

export function useCampaign() {
  const id = process.env.NEXT_PUBLIC_MAIN_CONTRACT_ID;
  return useQuery<CampaignInfo>({
    queryKey: ["campaign", id],
    queryFn: async () => {
      if (!id) throw new Error("main contract id not configured");
      const tuple = await readContract<unknown[]>({
        contractId: id,
        method: "info",
        args: [],
      });
      const [
        charity,
        sponsor,
        title,
        matchCap,
        donated,
        matched,
        deadline,
        donors,
        status,
      ] = tuple;
      const toBig = (n: unknown) =>
        typeof n === "bigint" ? n : BigInt(Number(n ?? 0));
      return {
        charity: String(charity ?? ""),
        sponsor: String(sponsor ?? ""),
        title: String(title ?? ""),
        matchCap: toBig(matchCap),
        donated: toBig(donated),
        matched: toBig(matched),
        deadline: Number(deadline),
        donors: Number(donors),
        status: decodeStatus(status),
      };
    },
    enabled: !!id,
    refetchInterval: 8_000,
  });
}

export function useMyDonation(address: string | null) {
  const id = process.env.NEXT_PUBLIC_MAIN_CONTRACT_ID;
  return useQuery<{ donation: bigint; refunded: boolean }>({
    queryKey: ["my-donation", id, address],
    queryFn: async () => {
      if (!id || !address) return { donation: 0n, refunded: false };
      const [d, r] = await Promise.all([
        readContract<bigint | number>({
          contractId: id,
          method: "donation_of",
          args: [addrArg(address)],
        }).catch(() => 0),
        readContract<boolean>({
          contractId: id,
          method: "refunded",
          args: [addrArg(address)],
        }).catch(() => false),
      ]);
      return {
        donation: typeof d === "bigint" ? d : BigInt(d || 0),
        refunded: !!r,
      };
    },
    enabled: !!id && !!address,
    refetchInterval: 8_000,
  });
}
