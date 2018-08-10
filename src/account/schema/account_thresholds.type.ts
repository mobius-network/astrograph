import { gql } from "apollo-server";

const accountFlagsType = gql`
  type AccountThresholds {
    id: ID!
    masterWeight: Int!
    low: Int!
    medium: Int!
    high: Int!
  }
`;

export { accountThresholdsType };
