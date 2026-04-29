"use client";

import { useAllCampaigns } from "./use-campaign";

export type GlobalStats = {
  donated: bigint;
  matched: bigint;
  matchCap: bigint;
  donors: number;
  campaignCount: number;
};

export function useGlobalStats(): { data: GlobalStats | undefined; isLoading: boolean } {
  const { data: campaigns, isLoading } = useAllCampaigns();

  if (!campaigns) return { data: undefined, isLoading };

  const data: GlobalStats = {
    donated: campaigns.reduce((a, c) => a + c.donated, 0n),
    matched: campaigns.reduce((a, c) => a + c.matched, 0n),
    matchCap: campaigns.reduce((a, c) => a + c.matchCap, 0n),
    donors: campaigns.reduce((a, c) => a + c.donors, 0),
    campaignCount: campaigns.length,
  };

  return { data, isLoading };
}
