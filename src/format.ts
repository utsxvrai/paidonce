import type { Finding } from "./engine.js";

export const rupees = (paise: number): string => `Rs ${(paise / 100).toLocaleString("en-IN")}`;

const WHY: Record<Finding["cause"], string> = {
  LATE_SUCCESS: "The first payment looked like it timed out, the customer paid again, and then the first one went through.",
  KEY_ROTATED: "The app retried on its own with a new idempotency key, so the gateway took a second payment.",
  SAME_QR: "One reusable QR was paid from two different apps for the same order.",
  DUPLICATE_LEDGER: "The bank was debited once. One webhook event was posted to our ledger twice.",
  SEPARATE_ORDERS: "There are two debits because there are two orders.",
  EVIDENCE_MISSING: "One payment has no bank line yet, so we cannot say whether the money left.",
  UNEXPLAINED: "The evidence fits no single known cause.",
  SINGLE_CHARGE: "Only one payment left the bank for this order.",
};
const DO: Record<Finding["action"], string> = {
  REFUND: "Refund",
  WAIT: "Do not refund: money is already on its way back.",
  ALREADY_RETURNED: "Do not refund: the extra money was already returned.",
  OVER_REFUNDED: "Stop: more was returned than was owed. Escalate.",
  FIX_LEDGER: "Do not refund: reverse the duplicate ledger entry.",
  HOLD: "Hold: a person must decide.",
  NO_REFUND: "No refund is due.",
};
export const why = (f: Finding): string => WHY[f.cause];
export const todo = (f: Finding): string => (f.action === "REFUND" ? `${DO.REFUND} ${rupees(f.refundDue)}.` : DO[f.action]);

export function summary(f: Finding): string {
  return [
    `${f.order}  ${f.cause}${f.root ? `  (root: ${f.root})` : ""}`,
    `  Why:    ${why(f)}`,
    `  Do:     ${todo(f)}`,
    `  Money:  order ${rupees(f.amount)}, debited ${rupees(f.paid)} in ${f.debits}, returned ${rupees(f.returned)}, on its way back ${rupees(f.inFlight)}`,
  ].join("\n");
}
