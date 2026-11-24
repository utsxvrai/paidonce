import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import type { Action, Cause, Dataset, Generated, Truth } from "./types.js";

type Attempt = Dataset["attempts"][number];
type Txn = Dataset["txns"][number];

const MIN = 60_000;
const DAY = 86_400_000;
const START = Date.parse("2026-11-01T00:00:00Z");
const OUTAGE = { start: Date.parse("2026-11-12T13:00:00Z"), end: Date.parse("2026-11-12T14:20:00Z") };
const APP_BAD = Date.parse("2026-11-08T06:00:00Z");
const APP_FIXED = Date.parse("2026-11-10T06:00:00Z");
const HOOK_BAD = Date.parse("2026-11-15T06:00:00Z");
const HOOK_FIXED = Date.parse("2026-11-16T18:00:00Z");
const PAYER_APPS = ["AppA", "AppB", "AppC"];

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (ms: number): string => new Date(ms).toISOString();
const pad = (n: number, w = 4): string => String(n).padStart(w, "0");

const DISPUTE_TEXT = [
  "paise do baar kat gaye {amt} ke, ek wapas karo",
  "mere account se 2 baar payment ho gaya ek hi order ka, please check",
  "UPI fail dikhaya phir bhi {amt} kata, dobara pay kiya. ab do baar kat gaya",
  "I was charged twice for one order, {amt} each",
  "double payment deducted, please refund one of them",
  "amount debited two times from my bank, only one order shows",
  "payment failed on screen but money is gone, I paid again and it went through",
  "why are there two debits of {amt}? I ordered once",
  "bhai ek order ke liye do transaction dikh rahe hai bank mein",
  "passbook shows {amt} twice on the same day, kindly look into it",
];
const OTHER_TEXT = [
  "where is my parcel, it is late by 3 days",
  "order abhi tak deliver nahi hua",
  "how do I change my delivery address",
  "app login nahi ho raha, OTP nahi aata",
  "wrong item received, I want an exchange",
  "coupon code apply nahi ho raha",
  "GST invoice chahiye pichle order ka",
  "item was damaged when it arrived",
];

interface Opts { seed?: number }

export function generate({ seed = 7 }: Opts = {}): Generated {
  const r = rng(seed);
  const int = (a: number, b: number): number => a + Math.floor(r() * (b - a + 1));
  const pick = <T>(xs: readonly T[]): T => xs[int(0, xs.length - 1)] as T;
  const data: Dataset = {
    customers: [], orders: [], components: [{ id: "psp-north" }, { id: "psp-south" }],
    releases: [
      { id: "app-4.1.0", service: "checkout-app", at: iso(START - 5 * DAY) },
      { id: "app-4.2.0", service: "checkout-app", at: iso(APP_BAD) },
      { id: "app-4.2.1", service: "checkout-app", at: iso(APP_FIXED) },
      { id: "hooks-1.8.0", service: "webhook-consumer", at: iso(START - 9 * DAY) },
      { id: "hooks-1.9.0", service: "webhook-consumer", at: iso(HOOK_BAD) },
      { id: "hooks-1.9.1", service: "webhook-consumer", at: iso(HOOK_FIXED) },
    ],
    outages: [{ id: "OUT-1", component: "psp-north", start: iso(OUTAGE.start), end: iso(OUTAGE.end) }],
    qrs: [
      { id: "QR-COUNTER-1", singleUse: false },
      { id: "QR-COUNTER-2", singleUse: false },
      { id: "QR-DYNAMIC", singleUse: true },
    ],
    attempts: [], txns: [], bankLines: [], webhooks: [], ledger: [], refunds: [], reversals: [], tickets: [],
  };
  const truth: Truth[] = [];
  const seq: Record<string, number> = {};
  const id = (p: string): string => `${p}${pad((seq[p] = (seq[p] ?? 0) + 1))}`;

  for (let i = 0; i < 420; i++) data.customers.push({ id: id("C"), name: `Sample Customer ${i + 1}` });

  const appRelease = (t: number): string => (t < APP_BAD ? "app-4.1.0" : t < APP_FIXED ? "app-4.2.0" : "app-4.2.1");
  const hookRelease = (t: number): string => (t < HOOK_BAD ? "hooks-1.8.0" : t < HOOK_FIXED ? "hooks-1.9.0" : "hooks-1.9.1");
  const amount = (): number => int(4, 180) * 2500;

  // Every case gets its own customer unless it passes one in, so cases cannot bleed into each other.
  let nextCustomer = 0;
  const customer = (): string => (data.customers[nextCustomer++] as { id: string }).id;

  const order = (t: number, amt: number, cust = customer()): string => {
    const o = id("ORD-");
    data.orders.push({ id: o, customer: cust, amount: amt, at: iso(t) });
    return o;
  };
  const attempt = (o: string, t: number, p: Partial<Attempt> = {}): Attempt => {
    const a: Attempt = {
      id: id("ATT-"), order: o, key: `idem-${pad(int(0, 99999999), 8)}`, at: iso(t), shown: "SUCCESS",
      shownAt: iso(t + int(4, 12) * 1000), auto: false, release: appRelease(t), qr: null, ...p,
    };
    data.attempts.push(a);
    return a;
  };
  const txn = (a: Attempt, t: number, amt: number, p: Partial<Txn> = {}): Txn => {
    const x: Txn = {
      id: id("UPI-"), attempt: a.id, amount: amt, status: "SUCCESS", at: iso(t), completedAt: iso(t + int(2, 9) * 1000),
      payerApp: pick(PAYER_APPS), component: r() < 0.5 ? "psp-north" : "psp-south", ...p,
    };
    data.txns.push(x);
    return x;
  };
  const debit = (x: Txn): void => {
    data.bankLines.push({ id: id("BNK-"), txn: x.id, amount: x.amount, at: x.completedAt ?? x.at });
  };
  const hook = (x: Txn, o: string, t: number, eventId = `evt-${x.id}`, post = true): void => {
    const w = id("WH-");
    data.webhooks.push({ id: w, eventId, txn: x.id, at: iso(t), release: hookRelease(t) });
    if (post) data.ledger.push({ id: id("LED-"), webhook: w, order: o, amount: x.amount });
  };
  const settle = (x: Txn, o: string, post = true): void => {
    debit(x);
    // 6% of webhooks never arrive. The bank line is the evidence of record, not the webhook.
    if (r() > 0.06) hook(x, o, Date.parse(x.completedAt ?? x.at) + int(1, 20) * 1000, undefined, post);
  };
  const refund = (x: Txn, status: "INITIATED" | "PROCESSED" | "FAILED", t: number): void => {
    data.refunds.push({ id: id("RFD-"), txn: x.id, amount: x.amount, status, at: iso(t) });
  };
  const reversal = (x: Txn, status: "PENDING" | "DONE", t: number): void => {
    data.reversals.push({ id: id("REV-"), txn: x.id, amount: x.amount, status, at: iso(t) });
  };

  /** Plants a return state for a true double debit and says what the right action now is. */
  const returns = (first: Txn, second: Txn, t: number): { action: Action; due: number } => {
    const x = r();
    if (x < 0.45) return { action: "REFUND", due: second.amount };
    if (x < 0.55) { refund(second, "FAILED", t + DAY); return { action: "REFUND", due: second.amount }; }
    if (x < 0.67) { reversal(first, "PENDING", t + DAY); return { action: "WAIT", due: 0 }; }
    if (x < 0.77) { refund(second, "INITIATED", t + DAY); return { action: "WAIT", due: 0 }; }
    if (x < 0.87) { reversal(first, "DONE", t + DAY); return { action: "ALREADY_RETURNED", due: 0 }; }
    if (x < 0.95) { refund(second, "PROCESSED", t + DAY); return { action: "ALREADY_RETURNED", due: 0 }; }
    reversal(first, "DONE", t + DAY);
    refund(second, "PROCESSED", t + DAY);
    return { action: "OVER_REFUNDED", due: 0 };
  };
  const plant = (o: string, cause: Cause, action: Action, refundDue: number, root: string | null): void => {
    truth.push({ order: o, cause, action, refundDue, root });
  };
  const anyTime = (): number => START + int(0, 20 * 1440) * MIN;
  const complain = (o: string, t: number, p: number): void => {
    if (r() > p) return;
    const ord = data.orders.find((x) => x.id === o) as Dataset["orders"][number];
    const named = r() < 0.5;
    const text = pick(DISPUTE_TEXT).replace("{amt}", `Rs ${ord.amount / 100}`) + (named ? ` (${o})` : "");
    data.tickets.push({ id: id("TKT-"), customer: ord.customer, order: named ? o : null, text, at: iso(t + int(30, 2880) * MIN) });
  };

  const lateSuccess = (t: number, root: string | null): void => {
    const amt = amount();
    const o = order(t, amt);
    const inOutage = root !== null;
    const comp = inOutage ? "psp-north" : "psp-south";
    const a = attempt(o, t, { shown: "TIMEOUT", shownAt: iso(t + 30_000) });
    const x1 = txn(a, t, amt, { component: comp, completedAt: iso(t + int(3, 25) * MIN) });
    settle(x1, o, false);
    const t2 = t + int(45, 170) * 1000;
    const x2 = txn(attempt(o, t2), t2, amt, { component: "psp-south" });
    settle(x2, o);
    const { action, due } = returns(x1, x2, t);
    plant(o, "LATE_SUCCESS", action, due, root);
    complain(o, t, 0.4);
  };
  for (let i = 0; i < 24; i++) lateSuccess(OUTAGE.start + int(0, 78) * MIN, "OUT-1");
  for (let i = 0; i < 5; i++) lateSuccess(START + int(0, 10 * 1440) * MIN, null);

  for (let i = 0; i < 19; i++) {
    const t = APP_BAD + int(5, 2 * 1440 - 10) * MIN;
    const amt = amount();
    const o = order(t, amt);
    const x1 = txn(attempt(o, t, { shown: "NONE" }), t, amt);
    settle(x1, o);
    const t2 = t + int(2, 5) * 1000;
    const x2 = txn(attempt(o, t2, { auto: true }), t2, amt);
    settle(x2, o, false);
    const { action, due } = returns(x1, x2, t);
    plant(o, "KEY_ROTATED", action, due, "app-4.2.0");
    complain(o, t, 0.35);
  }

  for (let i = 0; i < 10; i++) {
    const t = anyTime();
    const amt = amount();
    const o = order(t, amt);
    const qr = pick(["QR-COUNTER-1", "QR-COUNTER-2"]);
    const x1 = txn(attempt(o, t, { qr }), t, amt, { payerApp: "AppA" });
    settle(x1, o);
    const t2 = t + int(20, 90) * 1000;
    const x2 = txn(attempt(o, t2, { qr }), t2, amt, { payerApp: "AppB" });
    settle(x2, o, false);
    const { action, due } = returns(x1, x2, t);
    plant(o, "SAME_QR", action, due, qr);
    complain(o, t, 0.5);
  }

  for (let i = 0; i < 17; i++) {
    const t = HOOK_BAD + int(5, 36 * 60 - 60) * MIN;
    const amt = amount();
    const o = order(t, amt);
    const x = txn(attempt(o, t), t, amt);
    debit(x);
    const done = Date.parse(x.completedAt ?? x.at);
    hook(x, o, done + 2000);
    hook(x, o, done + int(20, 300) * 1000);
    plant(o, "DUPLICATE_LEDGER", "FIX_LEDGER", 0, "hooks-1.9.0");
    complain(o, t, 0.4);
  }

  for (let i = 0; i < 14; i++) {
    const t = anyTime();
    const amt = amount();
    const c = customer();
    const t2 = t + int(1, 20) * MIN;
    const o1 = order(t, amt, c);
    const o2 = order(t2, amt, c);
    settle(txn(attempt(o1, t), t, amt), o1);
    settle(txn(attempt(o2, t2), t2, amt), o2);
    plant(o1, "SEPARATE_ORDERS", "NO_REFUND", 0, null);
    plant(o2, "SEPARATE_ORDERS", "NO_REFUND", 0, null);
    complain(o2, t2, 0.5);
  }

  for (let i = 0; i < 8; i++) {
    const t = anyTime();
    const amt = amount();
    const o = order(t, amt);
    const x1 = txn(attempt(o, t, { shown: "TIMEOUT", shownAt: iso(t + 30_000) }), t, amt, { status: "PENDING", completedAt: null });
    void x1;
    const t2 = t + int(45, 170) * 1000;
    settle(txn(attempt(o, t2), t2, amt), o);
    plant(o, "EVIDENCE_MISSING", "HOLD", 0, null);
    complain(o, t, 0.6);
  }

  for (let i = 0; i < 4; i++) {
    const t = APP_FIXED + int(60, 8 * 1440) * MIN;
    const amt = amount();
    const o = order(t, amt);
    const x1 = txn(attempt(o, t), t, amt);
    settle(x1, o);
    const t2 = t + int(60, 400) * 1000;
    const x2 = txn(attempt(o, t2), t2, amt);
    settle(x2, o, false);
    plant(o, "UNEXPLAINED", "HOLD", 0, null);
    complain(o, t, 0.6);
  }

  // Near misses. Each one breaks exactly one clause of one rule, so a rule that forgets the clause gets it wrong.
  const twoDebits = (t: number, a: Partial<Attempt>, b: Partial<Attempt>, x: Partial<Txn>, y: Partial<Txn>, gap: number): { o: string; x1: Txn; x2: Txn } => {
    const amt = amount();
    const o = order(t, amt);
    const x1 = txn(attempt(o, t, a), t, amt, x);
    settle(x1, o);
    const x2 = txn(attempt(o, t + gap, b), t + gap, amt, y);
    settle(x2, o, false);
    return { o, x1, x2 };
  };
  for (let i = 0; i < 4; i++) {
    // The screen said timeout, but the payment had already completed: a display bug, not a late success.
    const t = APP_FIXED + int(60, 8 * 1440) * MIN;
    const c = twoDebits(t, { shown: "TIMEOUT", shownAt: iso(t + 30_000) }, {}, { completedAt: iso(t + 4000) }, {}, int(45, 170) * 1000);
    plant(c.o, "UNEXPLAINED", "HOLD", 0, null);
    complain(c.o, t, 0.6);
  }
  for (let i = 0; i < 5; i++) {
    // Timed out and succeeded late, but it was the app that retried, not the customer.
    const t = APP_BAD + int(5, 2 * 1440 - 10) * MIN;
    const c = twoDebits(t, { shown: "TIMEOUT", shownAt: iso(t + 30_000) }, { auto: true }, { completedAt: iso(t + 5 * MIN) }, {}, 33_000);
    const { action, due } = returns(c.x1, c.x2, t);
    plant(c.o, "KEY_ROTATED", action, due, "app-4.2.0");
    complain(c.o, t, 0.4);
  }
  for (let i = 0; i < 6; i++) {
    // Same gateway as the outage, but on a day it was healthy. Blaming the outage would be wrong.
    const t = START + int(0, 10 * 1440) * MIN;
    const c = twoDebits(t, { shown: "TIMEOUT", shownAt: iso(t + 30_000) }, {}, { component: "psp-north", completedAt: iso(t + 6 * MIN) }, {}, int(45, 170) * 1000);
    const { action, due } = returns(c.x1, c.x2, t);
    plant(c.o, "LATE_SUCCESS", action, due, null);
    complain(c.o, t, 0.4);
  }
  for (let i = 0; i < 3; i++) {
    // Same QR and same payer app twice: could be on purpose, so a person decides.
    const t = anyTime();
    const c = twoDebits(t, { qr: "QR-COUNTER-1" }, { qr: "QR-COUNTER-1" }, { payerApp: "AppC" }, { payerApp: "AppC" }, 40_000);
    plant(c.o, "UNEXPLAINED", "HOLD", 0, null);
  }
  for (let i = 0; i < 3; i++) {
    // The app reused its key correctly and the gateway charged twice anyway.
    const t = anyTime();
    const key = `idem-${pad(int(0, 99999999), 8)}`;
    const c = twoDebits(t, { key, shown: "NONE" }, { key, auto: true }, {}, {}, 4000);
    plant(c.o, "UNEXPLAINED", "HOLD", 0, null);
  }
  for (let i = 0; i < 4; i++) {
    // One payment captured in two halves: two events and two postings, both correct.
    const t = anyTime();
    const amt = amount();
    const o = order(t, amt);
    const x = txn(attempt(o, t), t, amt);
    debit(x);
    for (const part of [1, 2]) {
      const w = id("WH-");
      data.webhooks.push({ id: w, eventId: `evt-${x.id}-part${part}`, txn: x.id, at: iso(t + part * 5000), release: hookRelease(t) });
      data.ledger.push({ id: id("LED-"), webhook: w, order: o, amount: amt / 2 });
    }
    plant(o, "SINGLE_CHARGE", "NO_REFUND", 0, null);
  }
  for (let i = 0; i < 8; i++) {
    // Two orders by one customer that are not lookalikes: different amount, or hours apart.
    const t = anyTime();
    const c = customer();
    const amt = amount();
    const far = i % 2 === 0;
    const t2 = far ? t + int(120, 600) * MIN : t + int(1, 20) * MIN;
    const amt2 = far ? amt : amt + 2500;
    const o1 = order(t, amt, c);
    const o2 = order(t2, amt2, c);
    settle(txn(attempt(o1, t), t, amt), o1);
    settle(txn(attempt(o2, t2), t2, amt2), o2);
    plant(o1, "SINGLE_CHARGE", "NO_REFUND", 0, null);
    plant(o2, "SINGLE_CHARGE", "NO_REFUND", 0, null);
  }
  // Some outage victims wrote in about something else before they were ever double charged.
  const older = truth.filter((t) => t.root === "OUT-1").slice(0, 6);
  for (const v of older) {
    const ord = data.orders.find((x) => x.id === v.order) as Dataset["orders"][number];
    data.tickets.push({ id: id("TKT-"), customer: ord.customer, order: null, text: pick(OTHER_TEXT), at: iso(Date.parse(ord.at) - 2 * DAY) });
  }

  // Decoys: a timeout or failure followed by a paid retry, where the first attempt never took money.
  for (let i = 0; i < 45; i++) {
    const t = r() < 0.4 ? OUTAGE.start + int(0, 78) * MIN : anyTime();
    const amt = amount();
    const o = order(t, amt);
    const shown = r() < 0.5 ? "TIMEOUT" : "FAILED";
    txn(attempt(o, t, { shown, shownAt: iso(t + 30_000) }), t, amt, {
      status: "FAILED", completedAt: iso(t + (shown === "TIMEOUT" ? int(2, 12) * MIN : 8000)),
    });
    const t2 = t + int(45, 170) * 1000;
    settle(txn(attempt(o, t2), t2, amt), o);
    plant(o, "SINGLE_CHARGE", "NO_REFUND", 0, null);
    complain(o, t, 0.15);
  }
  // Decoys: redelivered webhooks that were deduplicated correctly.
  for (let i = 0; i < 20; i++) {
    const t = START + int(0, 13 * 1440) * MIN;
    const amt = amount();
    const o = order(t, amt);
    const x = txn(attempt(o, t), t, amt);
    debit(x);
    const done = Date.parse(x.completedAt ?? x.at);
    hook(x, o, done + 2000);
    hook(x, o, done + 40_000, undefined, false);
    plant(o, "SINGLE_CHARGE", "NO_REFUND", 0, null);
  }
  while (nextCustomer < data.customers.length) {
    const t = anyTime();
    const amt = amount();
    const o = order(t, amt);
    settle(txn(attempt(o, t), t, amt), o);
    plant(o, "SINGLE_CHARGE", "NO_REFUND", 0, null);
    if (r() < 0.16) {
      const c = (data.orders.at(-1) as Dataset["orders"][number]).customer;
      data.tickets.push({ id: id("TKT-"), customer: c, order: null, text: pick(OTHER_TEXT), at: iso(t + int(1, 5) * DAY) });
    }
  }
  return { data, truth };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { data, truth } = generate();
  mkdirSync("data", { recursive: true });
  writeFileSync("data/dataset.json", JSON.stringify(data, null, 1) + "\n");
  writeFileSync("data/truth.json", JSON.stringify(truth, null, 1) + "\n");
  console.log(Object.entries(data).map(([k, v]) => `${k}=${(v as unknown[]).length}`).join(" "));
}
