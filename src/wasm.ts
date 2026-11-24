import type { Graph, Row } from "./types.js";

interface WasmDb { execute(query: string, params?: string | null): string }

/** `copy` builds a second in-memory graph, because the WASM API has no transactions to roll back. */
export function wrapWasm(db: WasmDb, copy?: () => Graph): Graph {
  return {
    query: (cypher, params) => {
      const out = JSON.parse(db.execute(cypher, params ? JSON.stringify(params) : null)) as { rows: Row[]; error: unknown };
      if (out.error) throw new Error(typeof out.error === "string" ? out.error : JSON.stringify(out.error));
      return out.rows;
    },
    scratch: (fn) => {
      if (!copy) throw new Error("this graph was opened without a scratch copy");
      return fn(copy());
    },
  };
}
