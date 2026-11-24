import { pipeline } from "@huggingface/transformers";

const DISPUTE = [
  "paise do baar kat gaye", "mere account se 2 baar payment ho gaya ek hi order ka",
  "UPI fail dikhaya phir bhi paisa kata, dobara pay kiya", "I was charged twice for one order",
  "double payment deducted, please refund one", "amount debited two times", "payment failed but money gone, paid again",
];
const OTHER = [
  "where is my parcel", "order abhi tak deliver nahi hua", "how do I change my address", "app login nahi ho raha",
  "wrong item received, want exchange", "coupon code apply nahi ho raha", "invoice chahiye GST wala",
];

const embed = await pipeline("feature-extraction", "Xenova/multilingual-e5-small", { dtype: "q8" });
const vectors = async (texts: string[]): Promise<number[][]> => {
  const out: number[][] = [];
  for (const t of texts) out.push(((await embed(`query: ${t}`, { pooling: "mean", normalize: true })).tolist() as number[][])[0] ?? []);
  return out;
};
const dot = (a: number[], b: number[]): number => a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
const d = await vectors(DISPUTE);
const o = await vectors(OTHER);
let right = 0;
let total = 0;
for (const [i, q] of d.entries()) {
  for (const [j, same] of d.entries()) {
    if (i === j) continue;
    for (const other of o) {
      total++;
      if (dot(q, same) > dot(q, other)) right++;
    }
  }
}
console.log(`same-topic pair ranked above different-topic pair: ${right}/${total} (${Math.round((100 * right) / total)}%)`);
