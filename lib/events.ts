import { rpc, xdr, scValToNative } from "@stellar/stellar-sdk";
import { sorobanRpc } from "./soroban";

export type DonateEvent = {
  kind: "donate";
  id: string;
  ledger: number;
  ledgerClosedAt: string;
  txHash: string;
  campaignId: number;
  donor: string;
  amount: bigint;
  matched: bigint;
};

export type CloseEvent = {
  kind: "close";
  id: string;
  ledger: number;
  ledgerClosedAt: string;
  txHash: string;
  campaignId: number;
  charity: string;
  payout: bigint;
};

export type RefundEvent = {
  kind: "refund";
  id: string;
  ledger: number;
  ledgerClosedAt: string;
  txHash: string;
  campaignId: number;
  donor: string;
  amount: bigint;
};

export type ContractEvent = DonateEvent | CloseEvent | RefundEvent;

export async function getRecentEvents(
  contractId: string,
  windowLedgers = 5000
): Promise<ContractEvent[]> {
  const latest = await sorobanRpc.getLatestLedger();
  const startLedger = Math.max(1, latest.sequence - windowLedgers);

  const kinds = ["donate", "close", "refund"] as const;
  const filters = kinds.map((kind) => {
    const sym = xdr.ScVal.scvSymbol(kind).toXDR("base64");
    return {
      type: "contract" as const,
      contractIds: [contractId],
      topics: [[sym, "*", "*"]],
    };
  });

  const res = await sorobanRpc.getEvents({ startLedger, filters, limit: 50 });

  return res.events
    .map(decodeEvent)
    .filter((e): e is ContractEvent => e !== null)
    .reverse();
}

function decodeEvent(e: rpc.Api.EventResponse): ContractEvent | null {
  const topic = scValToNative(e.topic[0]) as string;
  const base = {
    id: e.id,
    ledger: e.ledger,
    ledgerClosedAt: e.ledgerClosedAt,
    txHash: e.txHash,
  };
  const toBig = (n: unknown) =>
    typeof n === "bigint" ? n : BigInt(Number(n ?? 0));
  const toCampaignId = (v: unknown) => Number(v ?? 0);

  if (topic === "donate") {
    const campaignId = toCampaignId(scValToNative(e.topic[1]));
    const donor = String(scValToNative(e.topic[2]));
    const v = scValToNative(e.value) as [unknown, unknown];
    return { ...base, kind: "donate", campaignId, donor, amount: toBig(v[0]), matched: toBig(v[1]) };
  }
  if (topic === "close") {
    const campaignId = toCampaignId(scValToNative(e.topic[1]));
    const charity = String(scValToNative(e.topic[2]));
    return { ...base, kind: "close", campaignId, charity, payout: toBig(scValToNative(e.value)) };
  }
  if (topic === "refund") {
    const campaignId = toCampaignId(scValToNative(e.topic[1]));
    const donor = String(scValToNative(e.topic[2]));
    return { ...base, kind: "refund", campaignId, donor, amount: toBig(scValToNative(e.value)) };
  }
  return null;
}
