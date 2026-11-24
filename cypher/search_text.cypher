MATCH (t:Ticket)
SEARCH t IN (FULLTEXT INDEX ticket_text FOR $q LIMIT 10) SCORE AS score
MATCH (c:Customer)-[:RAISED]->(t)
OPTIONAL MATCH (c)-[:PLACED]->(o:Order) WHERE o.at <= t.at
WITH t, c, score, collect(o.id) AS orders
RETURN t.id AS ticket, t.text AS text, c.id AS customer, score, orders
ORDER BY score DESC, ticket
