// One reusable QR was paid twice for the same order, from two different payer apps.
MATCH (o:Order)-[:HAS_ATTEMPT]->(a:Attempt)-[:CREATED]->(x:Txn)<-[:CLEARS]-(:BankLine),
      (o)-[:HAS_ATTEMPT]->(b:Attempt)-[:CREATED]->(y:Txn)<-[:CLEARS]-(:BankLine),
      (a)-[:SCANNED]->(q:Qr)<-[:SCANNED]-(b)
WHERE ($order IS NULL OR o.id = $order)
  AND a.at < b.at AND x.payerApp <> y.payerApp AND NOT q.singleUse
RETURN DISTINCT o.id AS order, q.id AS root
