// Where the money for each order is right now.
MATCH (o:Order)
WHERE $order IS NULL OR o.id = $order
CALL (o) {
  OPTIONAL MATCH (o)-[:HAS_ATTEMPT]->()-[:CREATED]->(t:Txn)<-[:CLEARS]-(b:BankLine)
  RETURN count(DISTINCT t) AS debits, coalesce(sum(b.amount), 0) AS paid
}
CALL (o) {
  OPTIONAL MATCH (o)-[:HAS_ATTEMPT]->()-[:CREATED]->(t:Txn)
    WHERE t.status <> 'FAILED' AND NOT EXISTS { (t)<-[:CLEARS]-(:BankLine) }
  RETURN count(t) AS unproven
}
CALL (o) {
  OPTIONAL MATCH (o)-[:HAS_ATTEMPT]->()-[:CREATED]->(:Txn)<-[:RETURNS]-(r)
  RETURN coalesce(sum(CASE WHEN r.status IN ['PROCESSED', 'DONE'] THEN r.amount ELSE 0 END), 0) AS returned,
         coalesce(sum(CASE WHEN r.status IN ['INITIATED', 'PENDING'] THEN r.amount ELSE 0 END), 0) AS inFlight
}
RETURN o.id AS order, o.amount AS amount, debits, paid, unproven, returned, inFlight
ORDER BY order
