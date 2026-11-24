import { readFileSync, writeFileSync } from "node:fs";
import { pipeline } from "@huggingface/transformers";
import type { Dataset } from "../src/types.js";

// Build-time only. The vectors are committed, so running the project needs no model and no network.
const MODEL = "Xenova/multilingual-e5-small";
const data = JSON.parse(readFileSync("data/dataset.json", "utf8")) as Dataset;
const embed = await pipeline("feature-extraction", MODEL, { dtype: "q8" });
const out: { id: string; vec: number[] }[] = [];
for (const t of data.tickets) {
  const v = (await embed(`query: ${t.text}`, { pooling: "mean", normalize: true })).tolist() as number[][];
  out.push({ id: t.id, vec: (v[0] ?? []).map((x) => Math.round(x * 1e4) / 1e4) });
}
writeFileSync("data/vectors.json", `[\n${out.map((o) => JSON.stringify(o)).join(",\n")}\n]\n`);
console.log(`${out.length} vectors, ${out[0]?.vec.length} dimensions, ${MODEL}`);
