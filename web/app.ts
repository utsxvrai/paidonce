import init, { RelateDb } from "@relate/relate-wasm";
import {
  blastRadius, explainTicket, findings, load, searchTickets, similarTickets, trail, whatIf, FIXES, type Finding, type TrailNode,
} from "../src/engine.js";
import { rupees, todo, why } from "../src/format.js";
import type { Dataset, Graph } from "../src/types.js";
import { wrapWasm } from "../src/wasm.js";
import { readCypher } from "./cypher.js";

type Child = Node | string;
const h = (tag: string, attrs: Record<string, string> = {}, ...kids: Child[]): HTMLElement => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...kids);
  return el;
};
const on = (el: HTMLElement, fn: () => void): HTMLElement => (el.addEventListener("click", fn), el);
const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;

await init({ module_or_path: "./relate_bg.wasm" });
const get = async <T>(p: string): Promise<T> => (await (await fetch(p)).json()) as T;
const [data, vectors] = await Promise.all([get<Dataset>("./dataset.json"), get<{ id: string; vec: number[] }[]>("./vectors.json")]);

const build = (withVectors: boolean): Graph => {
  const graph = wrapWasm(new RelateDb(), () => build(false));
  load(graph, readCypher, data, withVectors ? vectors : []);
  return graph;
};
const t0 = performance.now();
let graph = build(true);
$("status").textContent = `${data.orders.length} orders loaded into Relate in this tab, ${Math.round(performance.now() - t0)} ms`;
let all = findings(graph, readCypher);
let selected = "";

const disputes = data.tickets
  .map((t) => ({ t, e: explainTicket(graph, readCypher, t.id) }))
  .filter((x) => x.e?.findings.some((f) => f.cause !== "SINGLE_CHARGE"));

function inbox(ids: { id: string; text: string }[]): void {
  $("inbox").replaceChildren(...ids.map(({ id, text }) =>
    on(h("button", { class: id === selected ? "ticket on" : "ticket", type: "button" }, h("b", {}, id), h("span", {}, text)), () => show(id))));
}

const COLUMNS: Record<string, number> = {
  Ticket: 0, Customer: 0, Order: 1, Attempt: 2, Release: 3, Qr: 3, Txn: 3, Component: 4, Outage: 5,
  BankLine: 4, Webhook: 4, Refund: 4, Reversal: 4, LedgerEntry: 5,
};
const NS = "http://www.w3.org/2000/svg";
const svg = (tag: string, attrs: Record<string, string | number>, text?: string): SVGElement => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  if (text !== undefined) el.textContent = text;
  return el;
};

function drawTrail(f: Finding): SVGElement {
  const t = trail(graph, readCypher, f.order);
  const W = 182;
  const H = 42;
  const cols: TrailNode[][] = [[], [], [], [], [], []];
  const sorted = [...t.nodes].sort((a, b) => a.label.localeCompare(b.label) || (a.at ?? "").localeCompare(b.at ?? ""));
  for (const n of sorted) (cols[COLUMNS[n.label] ?? 5] as TrailNode[]).push(n);
  const rows = Math.max(...cols.map((c) => c.length));
  const pos = new Map<string, { x: number; y: number }>();
  const height = rows * (H + 16) + 12;
  cols.forEach((c, i) => c.forEach((n, j) => {
    const gap = height / c.length;
    pos.set(n.id, { x: 8 + i * (W + 34), y: gap * j + gap / 2 - H / 2 });
  }));
  const width = 8 + 6 * (W + 34) - 26;
  const root = svg("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `Evidence for ${f.order}`, style: `min-width:${width * 0.72}px` });
  for (const e of t.edges) {
    const a = pos.get(e.from);
    const b = pos.get(e.to);
    if (!a || !b) continue;
    const [l, r] = a.x <= b.x ? [a, b] : [b, a];
    const same = l.x === r.x;
    const x1 = l.x + W;
    const x2 = same ? r.x + W : r.x;
    const bend = same ? 26 : 20;
    const path = `M${x1} ${l.y + H / 2} C${x1 + bend} ${l.y + H / 2} ${same ? x2 + bend : x2 - bend} ${r.y + H / 2} ${x2} ${r.y + H / 2}`;
    root.append(svg("path", { d: path, class: e.from === f.root || e.to === f.root ? "edge root" : e.type === "RETURNS" ? "edge back" : "edge" }));
  }
  for (const n of t.nodes) {
    const p = pos.get(n.id) as { x: number; y: number };
    const g = svg("g", { class: `node ${n.label}${n.id === f.root ? " isroot" : ""}`, transform: `translate(${p.x} ${p.y})` });
    const detail = [n.amount === null ? "" : rupees(n.amount), n.note, n.at ? n.at.slice(11, 19) : ""].filter(Boolean).join(" · ");
    g.append(svg("rect", { width: W, height: H, rx: 5 }), svg("text", { x: 9, y: 17 }, `${n.label} ${n.id}`), svg("text", { x: 9, y: 33, class: "sub" }, detail));
    root.append(g);
  }
  return root;
}

function card(f: Finding): HTMLElement {
  const refund = f.action === "REFUND";
  const box = h("article", { class: "card" },
    h("header", {}, h("span", { class: "mono" }, f.order), h("span", { class: "cause" }, f.cause.replaceAll("_", " ").toLowerCase()),
      ...(f.root ? [h("span", { class: "mono root" }, `traced to ${f.root}`)] : [])),
    h("h2", { class: refund ? "do pay" : "do" }, todo(f)),
    h("p", {}, why(f)),
    h("dl", {}, ...([["Order", f.amount], [`Debited in ${f.debits}`, f.paid], ["Returned", f.returned], ["On its way back", f.inFlight]] as [string, number][])
      .map(([k, v]) => h("div", {}, h("dt", {}, k), h("dd", {}, rupees(v))))));
  if (refund) {
    box.append(on(h("button", { class: "act", type: "button" }, "What if the bank starts a reversal right now?"), () => {
      graph.query(
        `MATCH (:Order {id: $o})-[:HAS_ATTEMPT]->()-[:CREATED]->(t:Txn)<-[:CLEARS]-() WITH t ORDER BY t.at LIMIT 1
         CREATE (:Reversal {id: 'REV-LIVE-' + $o, amount: t.amount, status: 'PENDING', at: t.completedAt})-[:RETURNS]->(t)`, { o: f.order });
      all = findings(graph, readCypher);
      show(selected);
    }));
  }
  box.append(h("div", { class: "scroll" }, drawTrail(f)));
  if (f.root) box.append(blastPanel(f.root));
  return box;
}

function blastPanel(root: string): HTMLElement {
  const b = blastRadius(graph, readCypher, root, all);
  const silent = b.filter((x) => x.silent);
  const due = silent.reduce((s, x) => s + x.refundDue, 0);
  return h("section", { class: "blast" },
    h("h3", {}, `${root} hit ${b.length} orders. ${silent.length} of those customers have not complained.`),
    h("p", {}, `${rupees(due)} is still owed to people who never wrote in.`),
    h("div", { class: "dots" }, ...b.map((x) =>
      on(h("button", { type: "button", class: x.silent ? "dot silent" : "dot", title: `${x.order}: ${x.silent ? "silent" : "complained"}, ${x.action}`, "aria-label": `${x.order} ${x.silent ? "silent" : "complained"}` }), () => showOrder(x.order)))),
    h("p", { class: "key" }, h("i", { class: "dot" }), " complained ", h("i", { class: "dot silent" }), " silent. Select one to open it."));
}

function showOrder(order: string): void {
  selected = "";
  $("ticket").replaceChildren(h("p", { class: "quote" }, `${order}: no ticket. Found through the graph.`));
  $("cards").replaceChildren(...findings(graph, readCypher, order).map(card));
}

function show(id: string): void {
  selected = id;
  const e = explainTicket(graph, readCypher, id);
  if (!e) return;
  const near = similarTickets(graph, readCypher, id).slice(0, 4);
  $("ticket").replaceChildren(h("p", { class: "quote" }, e.text),
    h("p", { class: "near" }, "Similar wording: ", ...near.map((n) => on(h("button", { type: "button", class: "link" }, n.ticket), () => show(n.ticket)))));
  const fs = e.findings.filter((f) => f.cause !== "SINGLE_CHARGE");
  $("cards").replaceChildren(...(fs.length ? fs : e.findings).map(card));
  document.querySelectorAll("#inbox .ticket").forEach((b) => b.classList.toggle("on", b.querySelector("b")?.textContent === id));
}

const listDefault = (): void => inbox(disputes.map((d) => ({ id: d.t.id, text: d.t.text })));
$("q").addEventListener("input", () => {
  const q = ($("q") as HTMLInputElement).value;
  if (!q.trim()) return listDefault();
  inbox(searchTickets(graph, readCypher, q).map((x) => ({ id: x.ticket, text: x.text })));
});
$("reset").addEventListener("click", () => {
  graph = build(true);
  all = findings(graph, readCypher);
  if (selected) show(selected);
});
$("fixes").replaceChildren(...FIXES.map((fix) => on(h("button", { type: "button", class: "act" }, fix), () => {
  const w = whatIf(graph, readCypher, fix);
  const causes = ["LATE_SUCCESS", "KEY_ROTATED", "SAME_QR", "DUPLICATE_LEDGER", "UNEXPLAINED"] as const;
  $("whatif").replaceChildren(h("table", {}, h("tr", {}, h("th", {}, "Cause"), h("th", {}, "Today"), h("th", {}, `With ${fix}`)),
    ...causes.map((c) => h("tr", {}, h("td", {}, c.replaceAll("_", " ").toLowerCase()), h("td", {}, String(w.before[c] ?? 0)), h("td", {}, String(w.after[c] ?? 0)))),
    h("tr", { class: "cost" }, h("td", { colspan: "2" }, "Good payments it would also block"), h("td", {}, String(w.blockedGoodPayments)))));
})));
listDefault();
const first = disputes.find((d) => d.e?.findings.some((f) => f.root === "OUT-1" && f.action === "REFUND")) ?? disputes[0];
if (first) show(first.t.id);
