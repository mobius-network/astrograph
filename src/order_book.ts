import { getManager } from "typeorm";
import { AssetTransformer } from "../util/orm";

const dbQuery = `SELECT
	*,
	(pricen :: double precision / priced :: double precision) as pricef

FROM
((
	-- This query returns the "asks" portion of the summary, and it is very straightforward
	SELECT
		'ask' as type,
		co.pricen,
		co.priced,
		SUM(co.amount) as amount

	FROM  offers co

	WHERE 1=1
	AND   sellingasset = $1
	AND   buyingasset = $2

	GROUP BY
		co.pricen,
		co.priced,
		co.price

	ORDER BY co.price ASC

	LIMIT $3

) UNION (
	-- This query returns the "bids" portion, inverting the where clauses
	-- and the pricen/priced.  This inversion is necessary to produce the "bid"
	-- view of a given offer (which are stored in the db as an offer to sell)
	SELECT
		'bid'  as type,
		co.priced as pricen,
		co.pricen as priced,
		SUM(co.amount) as amount

	FROM offers co

	WHERE 1=1
	AND   sellingasset = $2
	AND   buyingasset = $1

	GROUP BY
		co.pricen,
		co.priced,
		co.price

	ORDER BY co.price ASC

	LIMIT $3
)) summary

ORDER BY type, pricef;
`;

export function load(selling: AssetID, buying: AssetID, limit: number) {
  const em = getManager();

  selling = AssetTransformer.to(selling);
  buying = AssetTransformer.to(buying);

  em.query(dbQuery, [selling, buying, limit]);
}
