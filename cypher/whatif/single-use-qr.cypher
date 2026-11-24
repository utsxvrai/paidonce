// A QR stops accepting money for an order once that order has been paid through it.
MATCH (o:Order)-[:HAS_ATTEMPT]->(a:Attempt)-[:SCANNED]->(q:Qr)<-[:SCANNED]-(b:Attempt)<-[:HAS_ATTEMPT]-(o),
      (a)-[:CREATED]->(x:Txn {status: 'SUCCESS'}), (b)-[:CREATED]->(t:Txn)
WHERE a.at < b.at AND x.completedAt <= b.at
OPTIONAL MATCH (t)<-[:CLEARS|REPORTS|RETURNS]-(d)
OPTIONAL MATCH (d)-[:POSTED]->(l:LedgerEntry)
WITH collect(DISTINCT t) AS ts, collect(DISTINCT d) AS ds, collect(DISTINCT l) AS ls
FOREACH (n IN ts | DETACH DELETE n)
FOREACH (n IN ds | DETACH DELETE n)
FOREACH (n IN ls | DETACH DELETE n)
RETURN 0 AS blockedGoodPayments
