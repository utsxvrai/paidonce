import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

// Deletes one clause at a time and checks that the tests notice. Restores each file afterwards.
const MUTATIONS: [file: string, clause: string, replacement: string][] = [
  ["causes/LATE_SUCCESS", " AND a.shownAt < x.completedAt", ""],
  ["causes/LATE_SUCCESS", " AND NOT b.auto", ""],
  ["causes/LATE_SUCCESS", "WHERE out.start <= a.at AND a.at <= out.end", ""],
  ["causes/SAME_QR", " AND x.payerApp <> y.payerApp", ""],
  ["causes/DUPLICATE_LEDGER", " AND w1.eventId = w2.eventId", ""],
  ["causes/SEPARATE_ORDERS", " AND o.amount = p.amount", ""],
  ["causes/SEPARATE_ORDERS", " <= 1800", " <= 99999"],
  ["causes/KEY_ROTATED", " AND a.key <> b.key", ""],
  ["blast", " WHERE t.at >= o.at", ""],
];

let survived = 0;
for (const [file, clause, replacement] of MUTATIONS) {
  const path = `cypher/${file}.cypher`;
  const original = readFileSync(path, "utf8");
  if (!original.includes(clause)) throw new Error(`${path} no longer contains "${clause}"`);
  let caught: boolean;
  try {
    writeFileSync(path, original.replace(clause, replacement));
    caught = spawnSync("npx", ["vitest", "run", "test/engine.test.ts"], { stdio: "ignore" }).status !== 0;
  } finally {
    writeFileSync(path, original);
  }
  if (!caught) survived++;
  console.log(`${caught ? "caught  " : "SURVIVED"}  ${file}: ${clause.trim()}`);
}
console.log(`${MUTATIONS.length - survived}/${MUTATIONS.length} caught`);
process.exitCode = survived ? 1 : 0;
