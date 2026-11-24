MATCH (x:Ticket {id: $ticket})
WITH x.vec AS v
MATCH (t:Ticket)
SEARCH t IN (VECTOR INDEX ticket_vec FOR v LIMIT 11) SCORE AS score
MATCH (c:Customer)-[:RAISED]->(t)
WHERE t.id <> $ticket
OPTIONAL MATCH (c)-[:PLACED]->(o:Order) WHERE o.at <= t.at
WITH t, c, score, collect(o.id) AS orders
RETURN t.id AS ticket, t.text AS text, c.id AS customer, score, orders
ORDER BY score DESC, ticket
