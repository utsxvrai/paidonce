import { readFileSync } from "node:fs";
import { initSync, RelateDb } from "@relate/relate-wasm";
import { beforeAll, describe, expect, it } from "vitest";
import { generate } from "../src/generate.js";
import { blastRadius, findings, load, searchTickets, trail, whatIf } from "../src/engine.js";
import { openNative } from "../src/native.js";
import { wrapWasm } from "../src/wasm.js";
import { readCypher } from "../src/cypher.js";
import type { Graph } from "../src/types.js";

const fresh = (seed?: number) => {
  const g = generate(seed === undefined ? {} : { seed });
  const graph = openNative(":memory:");
  load(graph, readCypher, g.data);
  return { graph, ...g };
};

describe("rules against planted truth", () => {
  for (const seed of [7, 1, 2, 3, 4, 5]) {
    it(`seed ${seed}: every order gets exactly one cause, and it is the planted one`, () => {
      const { graph, truth } = fresh(seed);
      const got = findings(graph, readCypher);
      expect(got.length).toBe(truth.length);
      const by = new Map(got.map((f) => [f.order, f]));
      for (const t of truth) {
        const f = by.get(t.order);
        expect({ order: t.order, cause: f?.cause, action: f?.action, due: f?.refundDue, root: f?.root })
          .toEqual({ order: t.order, cause: t.cause, action: t.action, due: t.refundDue, root: t.root });
      }
    });
  }
});

describe("safe action", () => {
  it("never asks for a refund when money is already going back", () => {
    const { graph, data } = fresh();
    const returning = new Set([
      ...data.refunds.filter((r) => r.status !== "FAILED").map((r) => r.txn),
      ...data.reversals.map((r) => r.txn),
    ]);
    const attemptOrder = new Map(data.attempts.map((a) => [a.id, a.order]));
    const orders = new Set(data.txns.filter((t) => returning.has(t.id)).map((t) => attemptOrder.get(t.attempt)));
    expect(orders.size).toBeGreaterThan(5);
    for (const f of findings(graph, readCypher)) {
      if (orders.has(f.order)) expect(f.action).not.toBe("REFUND");
    }
  });

  it("flips REFUND to WAIT the moment a reversal starts", () => {
    const { graph } = fresh();
    const f = findings(graph, readCypher).find((x) => x.action === "REFUND" && x.cause === "LATE_SUCCESS");
    if (!f) throw new Error("no refund case planted");
    graph.query(
      `MATCH (:Order {id: $o})-[:HAS_ATTEMPT]->()-[:CREATED]->(t:Txn) WITH t ORDER BY t.at LIMIT 1
       CREATE (:Reversal {id: 'REV-TEST', amount: t.amount, status: 'PENDING', at: t.at})-[:RETURNS]->(t)`,
      { o: f.order },
    );
    expect(findings(graph, readCypher, f.order)[0]?.action).toBe("WAIT");
  });
});

describe("evidence", () => {
  it("drops the cause when the proving bank line is removed", () => {
    const { graph } = fresh();
    const f = findings(graph, readCypher).find((x) => x.cause === "KEY_ROTATED");
    if (!f) throw new Error("no key rotation planted");
    graph.query(
      `MATCH (:Order {id: $o})-[:HAS_ATTEMPT]->()-[:CREATED]->(t:Txn)<-[c:CLEARS]-(:BankLine) WITH c LIMIT 1 DELETE c`,
      { o: f.order },
    );
    expect(findings(graph, readCypher, f.order)[0]).toMatchObject({ cause: "EVIDENCE_MISSING", action: "HOLD" });
  });

  it("returns a trail that touches both debits", () => {
    const { graph } = fresh();
    const f = findings(graph, readCypher).find((x) => x.cause === "LATE_SUCCESS" && x.root === "OUT-1");
    if (!f) throw new Error("no outage case planted");
    const t = trail(graph, readCypher, f.order);
    expect(t.nodes.filter((n) => n.label === "BankLine").length).toBe(2);
    expect(t.nodes.some((n) => n.id === "OUT-1")).toBe(true);
    const ids = new Set(t.nodes.map((n) => n.id));
    for (const e of t.edges) expect(ids.has(e.from) && ids.has(e.to)).toBe(true);
  });
});

describe("blast radius", () => {
  it("finds every order with the root, and marks the customers who never complained", () => {
    const { graph, truth, data } = fresh();
    const b = blastRadius(graph, readCypher, "OUT-1");
    expect(new Set(b.map((x) => x.order))).toEqual(new Set(truth.filter((t) => t.root === "OUT-1").map((t) => t.order)));
    const ord = new Map(data.orders.map((o) => [o.id, o]));
    for (const x of b) {
      const o = ord.get(x.order);
      const spoke = data.tickets.some((t) => t.customer === o?.customer && Date.parse(t.at) >= Date.parse(o.at));
      expect(x.silent).toBe(!spoke);
    }
    expect(b.some((x) => x.silent)).toBe(true);
  });
});

describe("what-if", () => {
  it("shows what each fix prevents and what it wrongly blocks, and leaves the graph unchanged", () => {
    const { graph } = fresh();
    const before = findings(graph, readCypher);
    const key = whatIf(graph, readCypher, "idempotency-per-order");
    const hooks = whatIf(graph, readCypher, "dedupe-webhooks");
    const qr = whatIf(graph, readCypher, "single-use-qr");
    expect(key.before.KEY_ROTATED).toBeGreaterThan(0);
    expect(key.after.KEY_ROTATED ?? 0).toBe(0);
    expect(key.after.DUPLICATE_LEDGER).toBe(key.before.DUPLICATE_LEDGER);
    expect(key.blockedGoodPayments).toBeGreaterThan(0);
    expect(hooks.after.DUPLICATE_LEDGER ?? 0).toBe(0);
    expect(qr.after.SAME_QR ?? 0).toBe(0);
    expect(findings(graph, readCypher)).toEqual(before);
  });
});

describe("search", () => {
  it("finds tickets by words, with or without query syntax characters", () => {
    const { graph } = fresh();
    expect(searchTickets(graph, readCypher, "charged twice").length).toBeGreaterThan(0);
    expect(() => searchTickets(graph, readCypher, 'a:b (c" AND ~ [')).not.toThrow();
  });
});

describe("browser engine", () => {
  let wasm: Graph;
  beforeAll(() => {
    initSync({ module: readFileSync("node_modules/@relate/relate-wasm/relate_bg.wasm") });
    wasm = wrapWasm(new RelateDb());
    load(wasm, readCypher, generate().data);
  });
  it("agrees with the native engine on every finding", () => {
    const { graph } = fresh();
    expect(findings(wasm, readCypher)).toEqual(findings(graph, readCypher));
  });
});
