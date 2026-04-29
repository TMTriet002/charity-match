"use client";

import { useMutation } from "@tanstack/react-query";
import { networkPassphrase } from "@/lib/stellar";
import {
  invokeContract,
  addrArg,
  i128Arg,
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

export function useDonate(address: string | null) {
  return useMutation({
    mutationFn: async (amount: string): Promise<{ contractHash: string }> => {
      if (!address) throw new Error("connect a wallet first");
      const id = requireId();
      const r = await invokeContract({
        contractId: id,
        method: "donate",
        args: [addrArg(address), i128Arg(xlmToStroops(amount))],
        source: address,
        signXdr: signer(address),
      });
      return { contractHash: r.hash };
    },
  });
}

export function useClose(address: string | null) {
  return useMutation({
    mutationFn: async (): Promise<{ contractHash: string }> => {
      if (!address) throw new Error("connect a wallet first");
      const id = requireId();
      const r = await invokeContract({
        contractId: id,
        method: "close",
        args: [addrArg(address)],
        source: address,
        signXdr: signer(address),
      });
      return { contractHash: r.hash };
    },
  });
}

export function useRefund(address: string | null) {
  return useMutation({
    mutationFn: async (): Promise<{ contractHash: string }> => {
      if (!address) throw new Error("connect a wallet first");
      const id = requireId();
      const r = await invokeContract({
        contractId: id,
        method: "refund",
        args: [addrArg(address)],
        source: address,
        signXdr: signer(address),
      });
      return { contractHash: r.hash };
    },
  });
}

export const useSendTx = useDonate;
