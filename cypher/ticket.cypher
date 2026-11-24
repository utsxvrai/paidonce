MATCH (c:Customer)-[:RAISED]->(t:Ticket {id: $ticket})
OPTIONAL MATCH (t)-[:MENTIONS]->(m:Order)
OPTIONAL MATCH (c)-[:PLACED]->(o:Order) WHERE o.at <= t.at
WITH t, c, m, o ORDER BY o.at DESC
RETURN t.id AS ticket, t.text AS text, c.id AS customer, m.id AS mentions, collect(o.id) AS orders
