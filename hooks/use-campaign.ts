"use client";

import { useQuery } from "@tanstack/react-query";
import { addrArg, readContract, u32Arg } from "@/lib/soroban";

export type Status = "Open" | "Closed";

export type CampaignInfo = {
  id: number;
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
  if (
    raw === 1 ||
    raw === "Closed" ||
    (typeof raw === "object" && raw && "tag" in raw && (raw as { tag: string }).tag === "Closed")
  ) {
    return "Closed";
  }
  return "Open";
}

function decodeCampaign(obj: Record<string, unknown>, id: number): CampaignInfo {
  const toBig = (n: unknown) =>
    typeof n === "bigint" ? n : BigInt(Number(n ?? 0));
  return {
    id,
    charity: String(obj.charity ?? ""),
    sponsor: String(obj.sponsor ?? ""),
    title: String(obj.title ?? ""),
    matchCap: toBig(obj.match_cap),
    donated: toBig(obj.donated),
    matched: toBig(obj.matched),
    deadline: Number(obj.deadline ?? 0),
    donors: Number(obj.donors ?? 0),
    status: decodeStatus(obj.status),
  };
}

export function useAllCampaigns() {
  const contractId = process.env.NEXT_PUBLIC_MAIN_CONTRACT_ID;
  return useQuery<CampaignInfo[]>({
    queryKey: ["campaigns", contractId],
    queryFn: async () => {
      if (!contractId) throw new Error("main contract id not configured");
      const rawIds = await readContract<unknown[]>({
        contractId,
        method: "list_campaigns",
        args: [],
      });
      const ids = (rawIds ?? []).map(Number);
      const campaigns = await Promise.all(
        ids.map(async (campaignId) => {
          const raw = await readContract<Record<string, unknown>>({
            contractId,
            method: "info",
            args: [u32Arg(campaignId)],
          });
          return decodeCampaign(raw, campaignId);
        })
      );
      return campaigns.reverse();
    },
    enabled: !!contractId,
    refetchInterval: 8_000,
    staleTime: 30_000,
  });
}

export function useCampaign(campaignId: number) {
  const contractId = process.env.NEXT_PUBLIC_MAIN_CONTRACT_ID;
  return useQuery<CampaignInfo>({
    queryKey: ["campaign", contractId, campaignId],
    queryFn: async () => {
      if (!contractId) throw new Error("main contract id not configured");
      const raw = await readContract<Record<string, unknown>>({
        contractId,
        method: "info",
        args: [u32Arg(campaignId)],
      });
      return decodeCampaign(raw, campaignId);
    },
    enabled: !!contractId && campaignId >= 0,
    refetchInterval: 8_000,
    staleTime: 30_000,
  });
}

export function useMyDonation(campaignId: number | null, address: string | null) {
  const contractId = process.env.NEXT_PUBLIC_MAIN_CONTRACT_ID;
  return useQuery<{ donation: bigint; refunded: boolean }>({
    queryKey: ["my-donation", contractId, campaignId, address],
    queryFn: async () => {
      if (!contractId || !address || campaignId === null)
        return { donation: 0n, refunded: false };
      const [d, r] = await Promise.all([
        readContract<bigint | number>({
          contractId,
          method: "donation_of",
          args: [u32Arg(campaignId), addrArg(address)],
        }).catch(() => 0),
        readContract<boolean>({
          contractId,
          method: "is_refunded",
          args: [u32Arg(campaignId), addrArg(address)],
        }).catch(() => false),
      ]);
      return {
        donation: typeof d === "bigint" ? d : BigInt(d || 0),
        refunded: !!r,
      };
    },
    enabled: !!contractId && !!address && campaignId !== null,
    refetchInterval: 8_000,
  });
}
