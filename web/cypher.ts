import schema from "../cypher/schema.cypher";
import loadText from "../cypher/load.cypher";
import money from "../cypher/money.cypher";
import trail from "../cypher/trail.cypher";
import blast from "../cypher/blast.cypher";
import ticket from "../cypher/ticket.cypher";
import searchText from "../cypher/search_text.cypher";
import searchSimilar from "../cypher/search_similar.cypher";
import lateSuccess from "../cypher/causes/LATE_SUCCESS.cypher";
import keyRotated from "../cypher/causes/KEY_ROTATED.cypher";
import sameQr from "../cypher/causes/SAME_QR.cypher";
import duplicateLedger from "../cypher/causes/DUPLICATE_LEDGER.cypher";
import separateOrders from "../cypher/causes/SEPARATE_ORDERS.cypher";
import idempotency from "../cypher/whatif/idempotency-per-order.cypher";
import dedupe from "../cypher/whatif/dedupe-webhooks.cypher";
import singleUse from "../cypher/whatif/single-use-qr.cypher";

const files: Record<string, string> = {
  schema, load: loadText, money, trail, blast, ticket, search_text: searchText, search_similar: searchSimilar,
  "causes/LATE_SUCCESS": lateSuccess, "causes/KEY_ROTATED": keyRotated, "causes/SAME_QR": sameQr,
  "causes/DUPLICATE_LEDGER": duplicateLedger, "causes/SEPARATE_ORDERS": separateOrders,
  "whatif/idempotency-per-order": idempotency, "whatif/dedupe-webhooks": dedupe, "whatif/single-use-qr": singleUse,
};

export function readCypher(name: string): string {
  const text = files[name];
  if (text === undefined) throw new Error(`no cypher file ${name}`);
  return text;
}
