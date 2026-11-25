import { readCypher } from "./cypher.js";
import { blastRadius, explainTicket, findings, FIXES, searchTickets, similarTickets, trail, whatIf, type Fix } from "./engine.js";
import { rupees, summary } from "./format.js";
import { openScratch, openStore } from "./open.js";
import { english } from "./gloss.js";
import { CAUSES } from "./types.js";

const USAGE = `paidonce <command>
  scan                     causes, actions and roots across all orders
  explain <TKT-..|ORD-..>  why, and what is safe to do now
  trail <ORD-..>           the evidence path behind an answer
  blast <root>             everyone hit by one root (OUT-1, app-4.2.0, hooks-1.9.0, QR-COUNTER-1)
  whatif <fix>             ${FIXES.join(" | ")}
  search <words>           find tickets by words
  similar <TKT-..>         find tickets by meaning`;

function run(cmd: string | undefined, args: string[]): string {
  const arg = args[0] ?? "";
  if (cmd !== "scan" && !arg) return USAGE;
  const g = cmd === "whatif" ? openScratch() : openStore();
  switch (cmd) {
    case "scan": {
      const all = findings(g, readCypher);
      const rows = CAUSES.map((c) => `${c.padEnd(18)}${String(all.filter((f) => f.cause === c).length).padStart(5)}`);
      const due = all.reduce((s, f) => s + f.refundDue, 0);
      const roots = [...new Set(all.map((f) => f.root).filter((r): r is string => r !== null))].sort();
      const hit = roots.map((r) => {
        const b = blastRadius(g, readCypher, r, all);
        return `${r.padEnd(18)}${String(b.length).padStart(5)} orders, ${b.filter((x) => x.silent).length} never complained`;
      });
      return [...rows, "", ...hit, "", `Refunds due now: ${rupees(due)} on ${all.filter((f) => f.action === "REFUND").length} orders`].join("\n");
    }
    case "explain": {
      if (arg.startsWith("ORD-")) return findings(g, readCypher, arg).map(summary).join("\n") || `No order ${arg}`;
      const e = explainTicket(g, readCypher, arg);
      if (!e) return `No ticket ${arg}`;
      const en = english(e.text);
      return [`${e.ticket} from ${e.customer}: "${e.text}"`, ...(en ? [`  In English: ${en}`] : []), "", ...(e.findings.length ? e.findings.map(summary) : ["No order found for this ticket."])].join("\n");
    }
    case "trail":
      return trail(g, readCypher, arg).edges.map((e) => `${e.from} -[${e.type}]-> ${e.to}`).join("\n") || `No order ${arg}`;
    case "blast": {
      const b = blastRadius(g, readCypher, arg);
      if (!b.length) return `Nothing traces back to ${arg}`;
      const due = b.reduce((s, x) => s + x.refundDue, 0);
      const silent = b.filter((x) => x.silent);
      return [
        `${arg}: ${b.length} orders, ${silent.length} customers never complained. Refunds due ${rupees(due)}, of which ${rupees(silent.reduce((s, x) => s + x.refundDue, 0))} to silent customers.`,
        ...b.map((x) => `  ${x.order}  ${x.customer}  ${x.action.padEnd(16)} ${x.silent ? "silent" : "complained"}`),
      ].join("\n");
    }
    case "whatif": {
      if (!FIXES.includes(arg as Fix)) return USAGE;
      const w = whatIf(g, readCypher, arg as Fix);
      return [
        `If we had ${w.fix}:`,
        ...CAUSES.filter((c) => w.before[c] || w.after[c]).map((c) => `  ${c.padEnd(18)}${String(w.before[c] ?? 0).padStart(5)} -> ${w.after[c] ?? 0}`),
        `  Good payments it would also have blocked: ${w.blockedGoodPayments}`,
      ].join("\n");
    }
    case "search":
      return searchTickets(g, readCypher, args.join(" ")).map((h) => `${h.score.toFixed(3)}  ${h.ticket}  ${h.text}`).join("\n") || "No match";
    case "similar":
      return similarTickets(g, readCypher, arg).map((h) => `${h.score.toFixed(3)}  ${h.ticket}  ${h.text}`).join("\n") || "No match";
    default:
      return USAGE;
  }
}

console.log(run(process.argv[2], process.argv.slice(3)));
