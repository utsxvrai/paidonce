import { Database } from "@relate/relate";
import type { Graph, Row } from "./types.js";

export function openNative(uri: string, opts: { readOnly?: boolean } = {}): Graph & { checkpoint(): void } {
  const db = opts.readOnly ? Database.open(uri, { readOnly: true }) : Database.open(uri);
  const conn = db.connect();
  const graph: Graph & { checkpoint(): void } = {
    query: (cypher, params) => conn.query(cypher, (params ?? {}) as never).rows as Row[],
    scratch: (fn) => {
      conn.begin();
      try {
        return fn(graph);
      } finally {
        conn.rollback();
      }
    },
    checkpoint: () => void db.checkpoint(),
  };
  return graph;
}
