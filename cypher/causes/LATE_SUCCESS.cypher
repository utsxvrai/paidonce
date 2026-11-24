// The customer was shown a timeout, paid again, and then the first payment went through too.
MATCH (o:Order)-[:HAS_ATTEMPT]->(a:Attempt)-[:CREATED]->(x:Txn)<-[:CLEARS]-(:BankLine),
      (o)-[:HAS_ATTEMPT]->(b:Attempt)-[:CREATED]->(y:Txn)<-[:CLEARS]-(:BankLine)
WHERE ($order IS NULL OR o.id = $order)
  AND a.at < b.at AND NOT b.auto
  AND a.shown IN ['TIMEOUT', 'FAILED'] AND a.shownAt < b.at AND a.shownAt < x.completedAt
OPTIONAL MATCH (x)-[:ROUTED_VIA]->(:Component)<-[:HIT]-(out:Outage)
  WHERE out.start <= a.at AND a.at <= out.end
RETURN DISTINCT o.id AS order, out.id AS root
