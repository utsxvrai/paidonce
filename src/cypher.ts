import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../cypher/", import.meta.url));
const cache = new Map<string, string>();

export function readCypher(name: string): string {
  const hit = cache.get(name);
  if (hit !== undefined) return hit;
  const text = readFileSync(`${root}${name}.cypher`, "utf8");
  cache.set(name, text);
  return text;
}
