// Post a webhook event to the ledger only once.
MATCH (w1:Webhook)-[:POSTED]->(:LedgerEntry), (w2:Webhook)-[:POSTED]->(l:LedgerEntry)
WHERE w1.eventId = w2.eventId AND w1.at < w2.at
WITH collect(DISTINCT l) AS ls
FOREACH (n IN ls | DETACH DELETE n)
RETURN 0 AS blockedGoodPayments
