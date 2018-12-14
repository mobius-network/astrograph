// This models represent GraphQL types from schema.
//
// Conventions:
//
// 1. Models must not contain relations: we load related via resolvers (ex: Transactions have no an array of
//    operations).
// 2. Models must have sufficient data to load related from either database or DGraph (ex: Account has
//    inflationDest as scalar, not as an Account).
// 3. Models have static factory methods with "from*" signature used as constructors (ex: fromValue,
//    fromXdr, fromDb, ...). NOTE: INVESTIGATE, CLASSES MIGHT BECOME HUGE.
//
export * from "./account";
export * from "./account_thresholds";
export * from "./account_flags";