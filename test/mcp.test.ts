import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, expect, it } from "vitest";

const client = new Client({ name: "test", version: "1" });
const call = async (name: string, args: Record<string, unknown>) => {
  const r = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: { text: string }[] };
  return { isError: r.isError ?? false, body: r.content[0]?.text ?? "" };
};

beforeAll(() => client.connect(new StdioClientTransport({ command: "npx", args: ["tsx", "src/mcp.ts"] })), 20_000);
afterAll(() => client.close());

it("explains a dispute and then runs a what-if in the same session", async () => {
  const e = await call("explain_dispute", { id: "ORD-0001" });
  expect(JSON.parse(e.body)[0].cause).toBe("LATE_SUCCESS");
  const w = await call("what_if", { fix: "dedupe-webhooks" });
  expect(w.isError).toBe(false);
  expect(JSON.parse(w.body).after.DUPLICATE_LEDGER).toBeUndefined();
});

it("refuses writes and caps rows", async () => {
  expect((await call("read_cypher", { statement: "CREATE (:X)" })).isError).toBe(true);
  const rows = JSON.parse((await call("read_cypher", { statement: "MATCH (n) RETURN n.id AS id" })).body);
  expect(rows).toMatchObject({ truncated: true });
  expect(rows.rows.length).toBe(100);
});
