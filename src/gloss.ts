/**
 * Fixed English translations for the Hinglish ticket templates in the sample data.
 * The customer's own words are always kept; this only adds a line a reader can follow.
 */
const AMT = "(Rs [\\d,.]+)";
const RULES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [new RegExp(`^paise do baar kat gaye ${AMT} ke, ek wapas karo`), (m) => `I was charged twice (${m[1]}). Please return one payment.`],
  [/^mere account se 2 baar payment ho gaya ek hi order ka, please check/, () => "My account was charged twice for a single order. Please check."],
  [new RegExp(`^UPI fail dikhaya phir bhi ${AMT} kata, dobara pay kiya\\. ab do baar kat gaya`), (m) => `UPI showed the payment as failed, but ${m[1]} was still taken. I paid again, and now I have been charged twice.`],
  [/^bhai ek order ke liye do transaction dikh rahe hai bank mein/, () => "My bank shows two transactions for one order."],
  [/^order abhi tak deliver nahi hua/, () => "My order has not been delivered yet."],
  [/^app login nahi ho raha, OTP nahi aata/, () => "I can't log in to the app. The OTP never arrives."],
  [/^coupon code apply nahi ho raha/, () => "The coupon code won't apply."],
  [/^GST invoice chahiye pichle order ka/, () => "I need a GST invoice for my last order."],
];

/** English for a Hinglish ticket, or null when the ticket is already in English. */
export function english(text: string): string | null {
  for (const [re, say] of RULES) {
    const m = text.match(re);
    if (m) {
      const order = /\((ORD-\d+)\)\s*$/.exec(text)?.[1];
      return order ? `${say(m)} (${order})` : say(m);
    }
  }
  return null;
}
