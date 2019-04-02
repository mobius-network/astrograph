import { makeExecutableSchema, mergeSchemas } from "apollo-server";

import resolvers from "./resolvers";

import { typeDefs as accountsTypeDefs } from "./accounts";
import { typeDefs as assetsTypeDefs } from "./assets";
import { typeDefs as ledgerTypeDefs } from "./ledgers";
import { typeDefs as offersTypeDefs } from "./offers";
import { typeDefs as operationsTypeDefs } from "./operations";
import { typeDefs as orderBookTypeDefs } from "./order_book";
import { typeDefs as paymentPathTypeDefs } from "./payment_path";
import { typeDefs as tradeAggregationsTypeDefs } from "./trade_aggregations";
import { typeDefs as transactionsTypeDefs } from "./transactions";
import { typeDefs } from "./type_defs";

const schema = makeExecutableSchema({
  typeDefs: [
    typeDefs,
    operationsTypeDefs,
    accountsTypeDefs,
    assetsTypeDefs,
    ledgerTypeDefs,
    offersTypeDefs,
    transactionsTypeDefs,
    orderBookTypeDefs,
    paymentPathTypeDefs,
    tradeAggregationsTypeDefs
  ],
  resolverValidationOptions: { requireResolversForResolveType: false }
});

export default mergeSchemas({
  schemas: [schema],
  resolvers,
  inheritResolversFromInterfaces: true
});
