import { db } from "../../database";
import { IHorizonOperationData } from "../../datasource/types";
import { Ledger, LedgerHeader, Operation } from "../../model";
import { OperationFactory } from "../../model/factories/operation_factory";
import { pubsub } from "../../pubsub";
import { createBatchResolver, makeConnection, operationsResolver, transactionsResolver } from "./util";

const LEDGER_CREATED = "LEDGER_CREATED";

const ledgerHeaderResolver = createBatchResolver<Ledger, LedgerHeader>((source: any) =>
  db.ledgerHeaders.findAllBySeq(source.map((r: Ledger) => r.seq))
);

export default {
  Ledger: {
    header: ledgerHeaderResolver,
    transactions: transactionsResolver,
    operations: operationsResolver,
    async payments(root: Ledger, args: any, ctx: any) {
      const records = await ctx.dataSources.horizon.getLedgerPayments(root.seq, args);
      return makeConnection<IHorizonOperationData, Operation>(records, r => OperationFactory.fromHorizon(r));
    }
  },
  Query: {
    ledger(root: any, args: any, ctx: any, info: any) {
      return new Ledger(args.seq);
    },
    ledgers(root: any, args: any, ctx: any, info: any) {
      return args.seq.map((seq: number) => new Ledger(seq));
    }
  },
  Subscription: {
    ledgerCreated: {
      resolve(payload: any, args: any, ctx: any, info: any) {
        return payload;
      },
      subscribe() {
        return pubsub.asyncIterator([LEDGER_CREATED]);
      }
    }
  }
};
