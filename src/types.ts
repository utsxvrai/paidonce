export const CAUSES = [
  "LATE_SUCCESS",
  "KEY_ROTATED",
  "SAME_QR",
  "DUPLICATE_LEDGER",
  "SEPARATE_ORDERS",
  "EVIDENCE_MISSING",
  "UNEXPLAINED",
  "SINGLE_CHARGE",
] as const;
export type Cause = (typeof CAUSES)[number];

export const ACTIONS = [
  "REFUND",
  "WAIT",
  "ALREADY_RETURNED",
  "OVER_REFUNDED",
  "FIX_LEDGER",
  "HOLD",
  "NO_REFUND",
] as const;
export type Action = (typeof ACTIONS)[number];

export interface Dataset {
  customers: { id: string; name: string }[];
  orders: { id: string; customer: string; amount: number; at: string }[];
  components: { id: string }[];
  releases: { id: string; service: string; at: string }[];
  outages: { id: string; component: string; start: string; end: string }[];
  qrs: { id: string; singleUse: boolean }[];
  attempts: {
    id: string; order: string; key: string; at: string; shown: "SUCCESS" | "TIMEOUT" | "FAILED" | "NONE";
    shownAt: string; auto: boolean; release: string; qr: string | null;
  }[];
  txns: {
    id: string; attempt: string; amount: number; status: "SUCCESS" | "FAILED" | "PENDING";
    at: string; completedAt: string | null; payerApp: string; component: string;
  }[];
  bankLines: { id: string; txn: string; amount: number; at: string }[];
  webhooks: { id: string; eventId: string; txn: string; at: string; release: string }[];
  ledger: { id: string; webhook: string; order: string; amount: number }[];
  refunds: { id: string; txn: string; amount: number; status: "INITIATED" | "PROCESSED" | "FAILED"; at: string }[];
  reversals: { id: string; txn: string; amount: number; status: "PENDING" | "DONE"; at: string }[];
  tickets: { id: string; customer: string; order: string | null; text: string; at: string }[];
}

/** Held outside the graph. Written by the generator as it plants each case, never by the rules. */
export interface Truth {
  order: string;
  cause: Cause;
  action: Action;
  refundDue: number;
  root: string | null;
}

export interface Generated { data: Dataset; truth: Truth[] }

export type Row = Record<string, unknown>;

/** The one interface both the native and the WASM engine implement. */
export interface Graph {
  query(cypher: string, params?: Row): Row[];
  /** Runs fn against the graph and throws every change away afterwards. */
  scratch<T>(fn: (g: Graph) => T): T;
}

export type ReadCypher = (name: string) => string;
