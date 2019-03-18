import { makeExecutableSchema, mergeSchemas } from "apollo-server";

import { typeDefs as accountsTypeDefs } from "./accounts";
import { typeDefs as horizonTypeDefs } from "./horizon";
import resolvers from "./resolvers";
import { typeDefs } from "./type_defs";

const schema = makeExecutableSchema({
  typeDefs: [typeDefs, horizonTypeDefs, accountsTypeDefs],
  resolverValidationOptions: { requireResolversForResolveType: false }
});

export default mergeSchemas({ schemas: [schema], resolvers });
