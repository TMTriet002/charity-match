"use client";

import { useQuery } from "@tanstack/react-query";
import { useCampaign } from "./use-campaign";
import { getRecentEvents } from "@/lib/events";

export type GlobalStats = {
  donated: bigint;
  matched: bigint;
  matchCap: bigint;
  donors: number;
  status: "Open" | "Closed";
};

export function useGlobalStats() {
  const mainId = process.env.NEXT_PUBLIC_MAIN_CONTRACT_ID;
  const { data } = useCampaign();

  return useQuery<GlobalStats>({
    queryKey: ["global-stats", mainId, data?.donated?.toString()],
    queryFn: async () => {
      if (!mainId) throw new Error("main contract id not configured");
      await getRecentEvents(mainId).catch(() => []);
      return {
        donated: data?.donated ?? 0n,
        matched: data?.matched ?? 0n,
        matchCap: data?.matchCap ?? 0n,
        donors: data?.donors ?? 0,
        status: data?.status ?? "Open",
      };
    },
    enabled: !!mainId,
    refetchInterval: 30_000,
  });
}
