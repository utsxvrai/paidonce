import { expect, it } from "vitest";
import { generate } from "../src/generate.js";
import { english } from "../src/gloss.js";

const HINDI = /\b(paise|kat|baar|nahi|mere|hai|chahiye|dikhaya|karo|bhai)\b/i;

it("gives every Hinglish ticket an English line, and leaves English tickets alone", () => {
  for (const seed of [7, 1, 2, 3]) {
    for (const t of generate({ seed }).data.tickets) {
      const en = english(t.text);
      if (HINDI.test(t.text)) {
        expect(en, t.text).not.toBeNull();
        expect(HINDI.test(en ?? ""), en ?? "").toBe(false);
      } else expect(en, t.text).toBeNull();
    }
  }
});

it("keeps the amount and the order the customer named", () => {
  expect(english("paise do baar kat gaye Rs 3975 ke, ek wapas karo (ORD-0002)")).toBe("I was charged twice (Rs 3975). Please return one payment. (ORD-0002)");
});
