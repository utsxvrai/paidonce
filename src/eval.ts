import { readFileSync } from "node:fs";
import { readCypher } from "./cypher.js";
import { explainTicket, findings, similarTickets } from "./engine.js";
import { openStore } from "./open.js";
import type { Action, Dataset, Truth } from "./types.js";

const read = <T>(p: string): T => JSON.parse(readFileSync(new URL(`../data/${p}`, import.meta.url), "utf8")) as T;
const data = read<Dataset>("dataset.json");
const truth = read<Truth[]>("truth.json");
const byOrder = new Map(truth.map((t) => [t.order, t]));
const graph = openStore();

interface Decision { refund: number }
interface Score { rightAction: number | null; wrongRefunds: number; wrongPaise: number; missed: number; missedPaise: number }

function score(orders: Iterable<string>, decide: (o: string) => Decision): Omit<Score, "rightAction"> {
  const s = { wrongRefunds: 0, wrongPaise: 0, missed: 0, missedPaise: 0 };
  for (const o of orders) {
    const due = byOrder.get(o)?.refundDue ?? 0;
    const paid = decide(o).refund;
    if (paid > due) { s.wrongRefunds++; s.wrongPaise += paid - due; }
    if (paid < due) { s.missed++; s.missedPaise += due - paid; }
  }
  return s;
}

const found = new Map(findings(graph, readCypher).map((f) => [f.order, f]));
const all = truth.map((t) => t.order);
const graphScore: Score = {
  ...score(all, (o) => ({ refund: found.get(o)?.refundDue ?? 0 })),
  rightAction: truth.filter((t) => found.get(t.order)?.action === t.action).length,
};

// Flat rule: same customer, same amount, two successful payments within 30 minutes means refund the later one.
const attemptOrder = new Map(data.attempts.map((a) => [a.id, a.order]));
const orderCustomer = new Map(data.orders.map((o) => [o.id, o.customer]));
const flat = new Map<string, number>();
const good = data.txns.filter((t) => t.status === "SUCCESS").sort((a, b) => a.at.localeCompare(b.at));
const lastSeen = new Map<string, string>();
for (const t of good) {
  const order = attemptOrder.get(t.attempt) as string;
  const key = `${orderCustomer.get(order)}|${t.amount}`;
  const prev = lastSeen.get(key);
  if (prev && Date.parse(t.at) - Date.parse(prev) <= 1_800_000) flat.set(order, t.amount);
  lastSeen.set(key, t.at);
}
const flatScore: Score = { ...score(all, (o) => ({ refund: flat.get(o) ?? 0 })), rightAction: null };

// A careful version: the same rule, but it skips orders where any refund or reversal is already done or under way.
const moving = new Set([
  ...data.refunds.filter((x) => x.status !== "FAILED").map((x) => x.txn),
  ...data.reversals.map((x) => x.txn),
]);
const txnOrder = new Map(data.txns.map((t) => [t.id, attemptOrder.get(t.attempt) as string]));
const movingOrders = new Set([...moving].map((t) => txnOrder.get(t)));
const careful: Score = { ...score(all, (o) => ({ refund: movingOrders.has(o) ? 0 : flat.get(o) ?? 0 })), rightAction: null };

const line = (name: string, s: Score): string =>
  `| ${name} | ${s.rightAction === null ? "n/a" : `${s.rightAction}/${truth.length}`} | ${s.wrongRefunds} | Rs ${s.wrongPaise / 100} | ${s.missed} | Rs ${s.missedPaise / 100} |`;
console.log(`## All ${truth.length} orders\n`);
console.log("| Method | Right action | Wrong refunds | Wrongly paid | Missed refunds | Still owed |\n|---|---|---|---|---|---|");
console.log(line("Flat rule (same customer + amount, 30 min)", flatScore));
console.log(line("Same, but skips orders with a refund or reversal", careful));
console.log(line("PaidOnce graph", graphScore));

// Text only: copy the true action of the most similar other ticket. This baseline is given the answers to its neighbours.
const actionOf = (ticket: string): Action | null => {
  const e = explainTicket(graph, readCypher, ticket);
  const t = e?.findings.map((f) => byOrder.get(f.order)).find((x) => x && x.cause !== "SINGLE_CHARGE")
    ?? (e?.findings[0] ? byOrder.get(e.findings[0].order) : undefined);
  return t?.action ?? null;
};
const tickets = data.tickets.filter((t) => actionOf(t.id) !== null);
let text = 0;
let ours = 0;
for (const t of tickets) {
  const want = actionOf(t.id);
  const near = similarTickets(graph, readCypher, t.id).find((h) => actionOf(h.ticket) !== null);
  if (near && actionOf(near.ticket) === want) text++;
  const fs = explainTicket(graph, readCypher, t.id)?.findings ?? [];
  if ((fs.find((f) => f.cause !== "SINGLE_CHARGE") ?? fs[0])?.action === want) ours++;
}
console.log(`\n## ${tickets.length} tickets\n\n| Method | Right action |\n|---|---|`);
console.log(`| Nearest ticket by text (vector) | ${text}/${tickets.length} |`);
console.log(`| PaidOnce graph | ${ours}/${tickets.length} |`);
