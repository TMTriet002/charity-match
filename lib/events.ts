import { rpc, xdr, scValToNative } from "@stellar/stellar-sdk";
import { sorobanRpc } from "./soroban";

export type DonateEvent = {
  kind: "donate";
  id: string;
  ledger: number;
  ledgerClosedAt: string;
  txHash: string;
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
  charity: string;
  payout: bigint;
};

export type RefundEvent = {
  kind: "refund";
  id: string;
  ledger: number;
  ledgerClosedAt: string;
  txHash: string;
  donor: string;
  amount: bigint;
};

export type ContractEvent = DonateEvent | CloseEvent | RefundEvent;

const TOPIC_LAYOUT = [
  { kind: "donate", topicCount: 2 },
  { kind: "close", topicCount: 2 },
  { kind: "refund", topicCount: 2 },
] as const;

export async function getRecentEvents(
  contractId: string,
  windowLedgers = 5000
): Promise<ContractEvent[]> {
  const latest = await sorobanRpc.getLatestLedger();
  const startLedger = Math.max(1, latest.sequence - windowLedgers);

  const filters = TOPIC_LAYOUT.map(({ kind, topicCount }) => {
    const sym = xdr.ScVal.scvSymbol(kind).toXDR("base64");
    const t = topicCount === 3 ? [sym, "*", "*"] : topicCount === 2 ? [sym, "*"] : [sym];
    return {
      type: "contract" as const,
      contractIds: [contractId],
      topics: [t],
    };
  });

  const res = await sorobanRpc.getEvents({
    startLedger,
    filters,
    limit: 50,
  });

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

  if (topic === "donate") {
    const donor = scValToNative(e.topic[1]) as string;
    const v = scValToNative(e.value) as [unknown, unknown];
    return {
      ...base,
      kind: "donate",
      donor,
      amount: toBig(v[0]),
      matched: toBig(v[1]),
    };
  }
  if (topic === "close") {
    const charity = scValToNative(e.topic[1]) as string;
    return {
      ...base,
      kind: "close",
      charity,
      payout: toBig(scValToNative(e.value)),
    };
  }
  if (topic === "refund") {
    const donor = scValToNative(e.topic[1]) as string;
    return {
      ...base,
      kind: "refund",
      donor,
      amount: toBig(scValToNative(e.value)),
    };
  }
  return null;
}
