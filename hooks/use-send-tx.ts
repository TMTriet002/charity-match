"use client";

import { useMutation } from "@tanstack/react-query";
import { networkPassphrase } from "@/lib/stellar";
import {
  invokeContract,
  addrArg,
  i128Arg,
  strArg,
  u32Arg,
  u64Arg,
  xlmToStroops,
} from "@/lib/soroban";
import { StellarWalletsKit } from "@/lib/wallets";

function signer(address: string) {
  return async (xdr: string) => {
    const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
      address,
      networkPassphrase,
    });
    return signedTxXdr;
  };
}

function requireId() {
  const id = process.env.NEXT_PUBLIC_MAIN_CONTRACT_ID;
  if (!id) throw new Error("NEXT_PUBLIC_MAIN_CONTRACT_ID is not set");
  return id;
}

export function useDonate(address: string | null, campaignId: number) {
  return useMutation({
    mutationFn: async (amount: string): Promise<{ contractHash: string }> => {
      if (!address) throw new Error("connect a wallet first");
      const r = await invokeContract({
        contractId: requireId(),
        method: "donate",
        args: [u32Arg(campaignId), addrArg(address), i128Arg(xlmToStroops(amount))],
        source: address,
        signXdr: signer(address),
      });
      return { contractHash: r.hash };
    },
  });
}

export function useClose(address: string | null, campaignId: number) {
  return useMutation({
    mutationFn: async (): Promise<{ contractHash: string }> => {
      if (!address) throw new Error("connect a wallet first");
      const r = await invokeContract({
        contractId: requireId(),
        method: "close",
        args: [u32Arg(campaignId), addrArg(address)],
        source: address,
        signXdr: signer(address),
      });
      return { contractHash: r.hash };
    },
  });
}

export function useRefund(address: string | null, campaignId: number) {
  return useMutation({
    mutationFn: async (): Promise<{ contractHash: string }> => {
      if (!address) throw new Error("connect a wallet first");
      const r = await invokeContract({
        contractId: requireId(),
        method: "refund",
        args: [u32Arg(campaignId), addrArg(address)],
        source: address,
        signXdr: signer(address),
      });
      return { contractHash: r.hash };
    },
  });
}

export type CreateParams = {
  charity: string;
  title: string;
  matchCapXlm: string;
  deadlineTs: number;
};

export function useCreateCampaign(address: string | null) {
  return useMutation({
    mutationFn: async (
      params: CreateParams
    ): Promise<{ contractHash: string; campaignId: number }> => {
      if (!address) throw new Error("connect a wallet first");
      const r = await invokeContract({
        contractId: requireId(),
        method: "create_campaign",
        args: [
          addrArg(address),
          addrArg(params.charity),
          strArg(params.title),
          i128Arg(xlmToStroops(params.matchCapXlm)),
          u64Arg(params.deadlineTs),
        ],
        source: address,
        signXdr: signer(address),
      });
      return {
        contractHash: r.hash,
        campaignId: Number(r.returnValue ?? 0),
      };
    },
  });
}
