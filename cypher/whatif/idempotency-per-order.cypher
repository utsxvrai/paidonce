// One live payment per order: a later attempt is refused while an earlier one is paid or still undecided.
MATCH (o:Order)-[:HAS_ATTEMPT]->(a:Attempt)-[:CREATED]->(x:Txn),
      (o)-[:HAS_ATTEMPT]->(b:Attempt)-[:CREATED]->(y:Txn)
WHERE a.at < b.at
  AND (x.status <> 'FAILED' OR x.completedAt > b.at)
OPTIONAL MATCH (y)<-[:CLEARS]-(k:BankLine)
WITH DISTINCT o, x, y, k
WITH collect(DISTINCT CASE WHEN x.status = 'FAILED' AND k IS NOT NULL THEN y.id END) AS good, collect(DISTINCT y.id) AS blocked
MATCH (t:Txn) WHERE t.id IN blocked
OPTIONAL MATCH (t)<-[:CLEARS|REPORTS|RETURNS]-(d)
OPTIONAL MATCH (d)-[:POSTED]->(l:LedgerEntry)
WITH good, collect(DISTINCT t) AS ts, collect(DISTINCT d) AS ds, collect(DISTINCT l) AS ls
FOREACH (n IN ts | DETACH DELETE n)
FOREACH (n IN ds | DETACH DELETE n)
FOREACH (n IN ls | DETACH DELETE n)
RETURN size(good) AS blockedGoodPayments
