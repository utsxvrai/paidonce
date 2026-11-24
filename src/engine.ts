import { CAUSES, type Action, type Cause, type Dataset, type Graph, type ReadCypher, type Row } from "./types.js";

export interface Finding {
  order: string;
  cause: Cause;
  root: string | null;
  action: Action;
  refundDue: number;
  amount: number;
  debits: number;
  paid: number;
  returned: number;
  inFlight: number;
}

const statements = (text: string): string[] => text.split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean);

export function load(graph: Graph, read: ReadCypher, data: Dataset, vectors: { id: string; vec: number[] }[] = []): void {
  for (const s of statements(read("schema"))) graph.query(s);
  const tables: Record<string, unknown> = { ...data, vectors };
  for (const s of statements(read("load"))) {
    const name = /\$(\w+)/.exec(s)?.[1] ?? "";
    graph.query(s, { [name]: tables[name] });
  }
}

const RULES: Cause[] = ["KEY_ROTATED", "LATE_SUCCESS", "SAME_QR", "DUPLICATE_LEDGER", "SEPARATE_ORDERS"];

/** Cause and safe action per order, computed live so it can never be stale. */
export function findings(graph: Graph, read: ReadCypher, order: string | null = null): Finding[] {
  const causes = new Map<string, { cause: Cause; root: string | null }[]>();
  for (const cause of RULES) {
    for (const r of graph.query(read(`causes/${cause}`), { order })) {
      const list = causes.get(String(r.order)) ?? [];
      list.push({ cause, root: (r.root as string | null) ?? null });
      causes.set(String(r.order), list);
    }
  }
  return graph.query(read("money"), { order }).map((m) => {
    const id = String(m.order);
    const n = (k: string): number => Number(m[k]);
    const matched = causes.get(id) ?? [];
    const base = {
      order: id, amount: n("amount"), debits: n("debits"), paid: n("paid"), returned: n("returned"), inFlight: n("inFlight"),
    };
    const { cause, root } = decideCause(matched, base.debits, n("unproven"));
    return { ...base, cause, root, ...decideAction(cause, base) };
  });
}

function decideCause(
  matched: { cause: Cause; root: string | null }[], debits: number, unproven: number,
): { cause: Cause; root: string | null } {
  // A payment we cannot prove either way outranks any story about it.
  if (unproven > 0) return { cause: "EVIDENCE_MISSING", root: null };
  if (matched.length === 1) return matched[0] as { cause: Cause; root: string | null };
  // Two rules claiming one order is a conflict, so a person decides.
  if (matched.length > 1) return { cause: "UNEXPLAINED", root: null };
  return { cause: debits > 1 ? "UNEXPLAINED" : "SINGLE_CHARGE", root: null };
}

function decideAction(
  cause: Cause, m: { amount: number; paid: number; returned: number; inFlight: number },
): { action: Action; refundDue: number } {
  if (cause === "EVIDENCE_MISSING" || cause === "UNEXPLAINED") return { action: "HOLD", refundDue: 0 };
  if (cause === "DUPLICATE_LEDGER") return { action: "FIX_LEDGER", refundDue: 0 };
  if (cause === "SINGLE_CHARGE" || cause === "SEPARATE_ORDERS") return { action: "NO_REFUND", refundDue: 0 };
  const due = m.paid - m.returned - m.inFlight - m.amount;
  if (due > 0) return { action: "REFUND", refundDue: due };
  if (due < 0) return { action: "OVER_REFUNDED", refundDue: 0 };
  return { action: m.inFlight > 0 ? "WAIT" : "ALREADY_RETURNED", refundDue: 0 };
}

export interface Affected { order: string; customer: string; amount: number; silent: boolean; cause: Cause; action: Action; refundDue: number }

export function blastRadius(graph: Graph, read: ReadCypher, root: string, all = findings(graph, read)): Affected[] {
  const hit = new Map(all.filter((f) => f.root === root).map((f) => [f.order, f]));
  return graph.query(read("blast"), { orders: [...hit.keys()] }).map((r) => {
    const f = hit.get(String(r.order)) as Finding;
    return {
      order: f.order, customer: String(r.customer), amount: f.amount, silent: Boolean(r.silent),
      cause: f.cause, action: f.action, refundDue: f.refundDue,
    };
  });
}

export interface TrailNode { id: string; label: string; at: string | null; note: string; amount: number | null }
export interface Trail { nodes: TrailNode[]; edges: { from: string; type: string; to: string }[] }

export function trail(graph: Graph, read: ReadCypher, order: string): Trail {
  const nodes = new Map<string, TrailNode>();
  const edges = graph.query(read("trail"), { order }).map((r) => {
    for (const side of ["from", "to"] as const) {
      nodes.set(String(r[side]), {
        id: String(r[side]), label: String(r[`${side}Label`]), at: (r[`${side}At`] as string | null) ?? null,
        note: String(r[`${side}Note`] ?? ""), amount: r[`${side}Amount`] == null ? null : Number(r[`${side}Amount`]),
      });
    }
    return { from: String(r.from), type: String(r.type), to: String(r.to) };
  });
  return { nodes: [...nodes.values()], edges };
}

export const FIXES = ["idempotency-per-order", "dedupe-webhooks", "single-use-qr"] as const;
export type Fix = (typeof FIXES)[number];
type Counts = Partial<Record<Cause, number>>;
export interface WhatIf { fix: Fix; before: Counts; after: Counts; blockedGoodPayments: number }

const count = (fs: Finding[]): Counts => {
  const out: Counts = {};
  for (const c of CAUSES) {
    const n = fs.filter((f) => f.cause === c).length;
    if (n > 0) out[c] = n;
  }
  return out;
};

/** Replays history with a fix in place, on a scratch copy that is always discarded. */
export function whatIf(graph: Graph, read: ReadCypher, fix: Fix): WhatIf {
  const before = count(findings(graph, read));
  return graph.scratch((g) => {
    const row = g.query(read(`whatif/${fix}`))[0] as Row;
    return { fix, before, after: count(findings(g, read)), blockedGoodPayments: Number(row.blockedGoodPayments) };
  });
}

export interface TicketHit { ticket: string; text: string; customer: string; score: number; orders: string[] }
const asHit = (r: Row): TicketHit => ({
  ticket: String(r.ticket), text: String(r.text), customer: String(r.customer), score: Number(r.score), orders: r.orders as string[],
});

export function searchTickets(graph: Graph, read: ReadCypher, text: string): TicketHit[] {
  const q = text.replace(/[^\p{L}\p{N}\s]/gu, " ").toLowerCase().trim();
  return q ? graph.query(read("search_text"), { q }).map(asHit) : [];
}

export function similarTickets(graph: Graph, read: ReadCypher, ticket: string): TicketHit[] {
  return graph.query(read("search_similar"), { ticket }).map(asHit);
}

export interface Explained { ticket: string; text: string; customer: string; findings: Finding[] }

/** A ticket names an order, or we look at every order its customer placed before it. */
export function explainTicket(graph: Graph, read: ReadCypher, ticket: string): Explained | null {
  const r = graph.query(read("ticket"), { ticket })[0];
  if (!r) return null;
  const orders = r.mentions ? [String(r.mentions)] : (r.orders as string[]);
  return {
    ticket, text: String(r.text), customer: String(r.customer),
    findings: orders.flatMap((o) => findings(graph, read, o)),
  };
}
