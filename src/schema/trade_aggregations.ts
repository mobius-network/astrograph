import { gql } from "apollo-server";

export const typeDefs = gql`
  type TradeAggregation {
    timeStamp: Int!
    tradeCount: Int!
    baseVolume: Float!
    counterVolume: Float!
    avg: Float!
    high: Float!
    low: Float!
    open: Float!
    close: Float!
  }

  enum TradeAggregationOrderByInput {
    ASC
    DESC
  }

  extend type Query {
    tradeAggregations(
      baseAsset: AssetInput!
      counterAsset: AssetInput!
      startTime: Int
      endTime: Int
      resolution: Int!
      limit: Int
      orderBy: TradeAggregationOrderByInput
    ): [TradeAggregation!]
  }

`;
