import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readCypher } from "./cypher.js";
import { load } from "./engine.js";
import { openNative } from "./native.js";
import type { Dataset, Graph } from "./types.js";

export const STORE = fileURLToPath(new URL("../store/paidonce.rl", import.meta.url));

/** The committed store, always read-only, so neither an agent nor a judge can change it by accident. */
export const openStore = (): Graph => openNative(STORE, { readOnly: true });

/** What-if needs to write, so it runs on an in-memory graph built from the same rows as the store. */
export function openScratch(): Graph {
  const graph = openNative(":memory:");
  load(graph, readCypher, JSON.parse(readFileSync(new URL("../data/dataset.json", import.meta.url), "utf8")) as Dataset);
  return graph;
}
