import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { readCypher } from "./cypher.js";
import { load } from "./engine.js";
import { openNative } from "./native.js";
import type { Dataset } from "./types.js";

const path = "store/paidonce.rl";
mkdirSync("store", { recursive: true });
rmSync(path, { force: true });
const graph = openNative(path);
load(
  graph, readCypher,
  JSON.parse(readFileSync("data/dataset.json", "utf8")) as Dataset,
  JSON.parse(readFileSync("data/vectors.json", "utf8")) as { id: string; vec: number[] }[],
);
graph.checkpoint();
const [n] = graph.query("MATCH (n) RETURN count(n) AS nodes");
const [e] = graph.query("MATCH ()-[r]->() RETURN count(r) AS rels");
console.log(`${path}: ${String(n?.nodes)} nodes, ${String(e?.rels)} relationships`);
