# Devpost draft

**Title:** PaidOnce

**Tagline:** Charged twice? See why, whether a refund is safe right now, and who else was hit but never complained.

**Repo:** https://github.com/utsxvrai/paidonce

**Live demo:** https://utsxvrai.github.io/paidonce/

**Demo video:** https://youtu.be/PqckVk8gdic

**Relate mode:** Single file

## Inspiration
"I was charged twice" looks like a simple ticket. The answer sits across the ledger, the gateway, the bank, the webhook consumer and the release log, and the quick fix (refund one) is often wrong.

## What it does
- Explains a double charge with the payment evidence that proves it.
- Says what is safe now: refund, wait, fix the ledger, or hold. If the bank has started a reversal, the answer changes.
- Walks from one ticket to its root (outage, release, QR) and lists every other customer hit, including the ones who never wrote in.
- Replays the month with a fix in place, and reports the good payments that fix would also block.

## How we built it
TypeScript on Relate's embedded Node library with a single-file store. The browser demo runs the same Cypher files on Relate's WebAssembly build. Seven MCP tools let an agent ask the same questions. Vector and full-text search find tickets; only graph evidence decides.

## Challenges
Our first tests passed even when we deleted clauses from the rules, because the synthetic data was too clean. We planted near misses that break one clause each, and then every one of nine deletions was caught. Vector search was also weak on Hinglish tickets, so we made sure it never decides a refund.

## What we learned
Reading "where is the money now" as a path (debit, reversal, refund) prevents the worst mistake, paying the same money back twice.

## What's next
Partial refunds, chargebacks, and importing real gateway exports.

## Product capabilities, third-party tools and AI tools
Relate 1.2.0: embedded Node library, single-file store, read-only opens, transactions, vector and full-text indexes, constraints, WebAssembly. MCP TypeScript SDK, Zod, Transformers.js (`Xenova/multilingual-e5-small`, build time only), esbuild, Vitest. Built with Claude Code, which wrote most of the code, tests and documentation under the author's direction and review. The demo video is narrated with the author's own AI voice clone (ElevenLabs); Claude Code scripted the screen recording (Playwright) and the edit (ffmpeg). No code predates the contest. All data is synthetic.
