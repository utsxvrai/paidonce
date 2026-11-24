// Two debits of the same size, but the customer really placed two orders.
MATCH (o:Order)<-[:PLACED]-(c:Customer)-[:PLACED]->(p:Order)
WHERE ($order IS NULL OR o.id = $order)
  AND o.id <> p.id AND o.amount = p.amount
  AND abs(duration.inSeconds(o.at, p.at).seconds) <= 1800
  AND EXISTS { (o)-[:HAS_ATTEMPT]->()-[:CREATED]->(:Txn)<-[:CLEARS]-(:BankLine) }
  AND EXISTS { (p)-[:HAS_ATTEMPT]->()-[:CREATED]->(:Txn)<-[:CLEARS]-(:BankLine) }
RETURN DISTINCT o.id AS order, null AS root
