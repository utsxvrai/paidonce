// The app retried by itself with a new idempotency key, so the gateway saw two payments.
MATCH (o:Order)-[:HAS_ATTEMPT]->(a:Attempt)-[:CREATED]->(x:Txn)<-[:CLEARS]-(:BankLine),
      (o)-[:HAS_ATTEMPT]->(b:Attempt)-[:CREATED]->(y:Txn)<-[:CLEARS]-(:BankLine),
      (b)-[:RAN_ON]->(rel:Release)
WHERE ($order IS NULL OR o.id = $order)
  AND a.at < b.at AND b.auto AND a.key <> b.key
RETURN DISTINCT o.id AS order, rel.id AS root
