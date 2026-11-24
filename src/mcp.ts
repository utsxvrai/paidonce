import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readCypher } from "./cypher.js";
import { blastRadius, explainTicket, findings, FIXES, searchTickets, similarTickets, trail, whatIf } from "./engine.js";
import { todo, why } from "./format.js";
import { openScratch, openStore } from "./open.js";

const server = new McpServer({ name: "paidonce", version: "0.1.0" });
const MAX_ROWS = 100;
const reply = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 1) }] });
const g = () => openStore();
const explain = (f: ReturnType<typeof findings>[number]) => ({ ...f, why: why(f), do: todo(f) });

server.registerTool("find_tickets", {
  description: "Find support tickets by words. Use this first when you only have a complaint.",
  inputSchema: { words: z.string() },
}, ({ words }) => reply(searchTickets(g(), readCypher, words)));

server.registerTool("similar_tickets", {
  description: "Tickets close in meaning to one ticket. Candidates only: never decide a refund from similarity.",
  inputSchema: { ticket: z.string() },
}, ({ ticket }) => reply(similarTickets(g(), readCypher, ticket)));

server.registerTool("explain_dispute", {
  description: "Why a customer was charged twice and what is safe to do now. Takes a ticket id (TKT-) or order id (ORD-). Amounts are in paise.",
  inputSchema: { id: z.string() },
}, ({ id }) => {
  const graph = g();
  if (id.startsWith("ORD-")) return reply(findings(graph, readCypher, id).map(explain));
  const e = explainTicket(graph, readCypher, id);
  return reply(e ? { ...e, findings: e.findings.map(explain) } : { error: `No ticket ${id}` });
});

server.registerTool("evidence_trail", {
  description: "Every node and relationship behind the answer for one order. Cite these ids.",
  inputSchema: { order: z.string() },
}, ({ order }) => reply(trail(g(), readCypher, order)));

server.registerTool("blast_radius", {
  description: "All orders that share one root cause, and which customers have not complained yet.",
  inputSchema: { root: z.string().describe("A root from explain_dispute, such as OUT-1 or app-4.2.0") },
}, ({ root }) => reply(blastRadius(g(), readCypher, root)));

server.registerTool("what_if", {
  description: "Replay history with a fix in place. Shows what it prevents and which good payments it blocks. Always rolled back.",
  inputSchema: { fix: z.enum(FIXES) },
}, ({ fix }) => reply(whatIf(openScratch(), readCypher, fix)));

server.registerTool("read_cypher", {
  description: `Run a read-only Cypher query. The store is opened read-only. At most ${MAX_ROWS} rows come back.`,
  inputSchema: { statement: z.string() },
}, ({ statement }) => {
  try {
    const rows = g().query(statement);
    return reply({ rows: rows.slice(0, MAX_ROWS), truncated: rows.length > MAX_ROWS });
  } catch (e) {
    return { ...reply({ error: (e as Error).message }), isError: true };
  }
});

await server.connect(new StdioServerTransport());
