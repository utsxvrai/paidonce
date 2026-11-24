// For a set of orders that share one root: who is affected, and who has not complained.
MATCH (c:Customer)-[:PLACED]->(o:Order)
WHERE o.id IN $orders
RETURN o.id AS order, c.id AS customer, o.amount AS amount,
       NOT EXISTS { MATCH (c)-[:RAISED]->(t:Ticket) WHERE t.at >= o.at } AS silent
ORDER BY order
