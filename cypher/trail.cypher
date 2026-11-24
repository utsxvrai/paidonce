// Every node that bears on one order, as edges.
MATCH (o:Order {id: $order})
CALL (o) {
  MATCH (o)<-[e:PLACED]-() RETURN e
  UNION MATCH (o)<-[:PLACED]-(:Customer)-[e:RAISED]->(t:Ticket) WHERE t.at >= o.at RETURN e
  UNION MATCH (o)<-[e:MENTIONS]-() RETURN e
  UNION MATCH (o)-[e:HAS_ATTEMPT]->() RETURN e
  UNION MATCH (o)-[:HAS_ATTEMPT]->()-[e:RAN_ON|SCANNED|CREATED]->() RETURN e
  UNION MATCH (o)-[:HAS_ATTEMPT]->()-[:CREATED]->(:Txn)-[e:ROUTED_VIA]->() RETURN e
  UNION MATCH (o)-[:HAS_ATTEMPT]->(a)-[:CREATED]->(:Txn)-[:ROUTED_VIA]->()<-[e:HIT]-(out:Outage) WHERE out.start <= a.at AND a.at <= out.end RETURN e
  UNION MATCH (o)-[:HAS_ATTEMPT]->()-[:CREATED]->(:Txn)<-[e:CLEARS|REPORTS|RETURNS]-() RETURN e
  UNION MATCH (o)-[:HAS_ATTEMPT]->()-[:CREATED]->(:Txn)<-[:REPORTS]-(:Webhook)-[e:HANDLED_BY|POSTED]->() RETURN e
  UNION MATCH (o)<-[e:CREDITS]-() RETURN e
}
WITH DISTINCT e, startNode(e) AS a, endNode(e) AS b
RETURN type(e) AS type,
       a.id AS from, labels(a)[0] AS fromLabel, toString(a.at) AS fromAt, coalesce(a.status, a.shown, a.payerApp, '') AS fromNote, a.amount AS fromAmount,
       b.id AS to, labels(b)[0] AS toLabel, toString(b.at) AS toAt, coalesce(b.status, b.shown, b.payerApp, '') AS toNote, b.amount AS toAmount
ORDER BY type, from, to
