// Money left the bank once, but one webhook event was posted to our ledger twice.
MATCH (o:Order)-[:HAS_ATTEMPT]->(:Attempt)-[:CREATED]->(x:Txn)<-[:CLEARS]-(:BankLine),
      (x)<-[:REPORTS]-(w1:Webhook)-[:POSTED]->(:LedgerEntry)-[:CREDITS]->(o),
      (x)<-[:REPORTS]-(w2:Webhook)-[:POSTED]->(:LedgerEntry)-[:CREDITS]->(o),
      (w2)-[:HANDLED_BY]->(rel:Release)
WHERE ($order IS NULL OR o.id = $order)
  AND w1.at < w2.at AND w1.eventId = w2.eventId
RETURN DISTINCT o.id AS order, rel.id AS root
