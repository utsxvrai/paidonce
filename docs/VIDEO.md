# Demo video script (target 1:45, hard limit 2:00)

This is the outline. The finished video is 1:24, recorded from the live demo at 1920x1080, with no music.

| Time | Screen | Say |
|---|---|---|
| 0:00 | Demo, TKT-0001 | "A customer writes: paise do baar kat gaye. The quick answer is to refund one. That is often wrong." |
| 0:12 | Evidence graph | "PaidOnce walks the payment graph in Relate. The first attempt timed out on screen, the customer paid again, then the first payment went through. Two bank debits, one order." |
| 0:32 | Orange outage edge | "It traces to one gateway outage." |
| 0:40 | Press the reversal button | "Now the bank starts a reversal. Same queries, new answer: do not refund. Refunding here would pay the money back twice." |
| 0:58 | Blast radius dots | "One ticket, but 24 orders. 19 of these customers never complained. I can open any of them." |
| 1:12 | What-if, idempotency | "What would have stopped it? Replayed on a scratch graph: one live payment per order removes these causes. It would also block 24 good payments, and we show that." |
| 1:28 | Terminal: `npm run paidonce explain TKT-0001`, `npm run eval` | "The same Cypher runs in the CLI, in the browser, and over MCP for an agent. On our synthetic data a careful flat rule makes 28 wrong refunds. The README explains how to read that number." |
| 1:42 | README top | "One Relate file, no server, no API key. PaidOnce." |
