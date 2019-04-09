import { fieldsList } from "graphql-fields-list";
import { createBatchResolver as create } from "graphql-resolve-batch";
import { Memo } from "stellar-sdk";
import { IHorizonTransactionData } from "../../datasource/types";
import { Account, Ledger, MutationType, Transaction } from "../../model";
import { TransactionWithXDRFactory } from "../../model/factories";

interface IWithPagingToken {
  paging_token: string;
}

export function createBatchResolver<T, R>(loadFn: any) {
  return create<T, R>(async (source: ReadonlyArray<T>, args: any, context: any, info: any) =>
    loadFn(source, args, context, info)
  );
}

export function idOnlyRequested(info: any): boolean {
  const requestedFields = fieldsList(info);

  if (requestedFields.length === 1 && requestedFields[0] === "id") {
    return true;
  }

  return false;
}

export function makeConnection<T extends IWithPagingToken, R>(records: T[], nodeBuilder: (r: T) => R) {
  const edges = records.map(record => {
    return {
      node: nodeBuilder(record),
      cursor: record.paging_token
    };
  });

  return {
    nodes: edges.map(edge => edge.node),
    edges,
    pageInfo: {
      startCursor: records.length !== 0 ? records[0].paging_token : null,
      endCursor: records.length !== 0 ? records[records.length - 1].paging_token : null
    }
  };
}

export function memoResolver(obj: any) {
  if (!obj.memo) {
    return null;
  }

  const memo = obj.memo as Memo;

  return {
    type: memo.type,
    value: memo.getPlainValue()
  };
}

export function eventMatches(args: any, id: string, mutationType: MutationType): boolean {
  const idEq: boolean | null = args.idEq ? id === args.idEq : null;
  const idIn: boolean | null = args.idIn ? args.idIn.includes(id) : null;
  const mutationTypeIn: boolean | null = args.mutationTypeIn ? args.mutationTypeIn.includes(mutationType) : null;

  const conditions = [idEq, idIn, mutationTypeIn].filter(c => c !== null);

  return conditions.every(c => c === true);
}

export async function transactionsResolver(obj: any, args: any, ctx: any) {
  let data: IHorizonTransactionData[];
  const dataSource = ctx.dataSources.horizon;
  const { first, after, last, before } = args;

  let order;

  if (last) {
    order = "desc";
  } else if (first) {
    order = "asc";
  } else {
    throw new Error("Missing paging parameters");
  }

  const pagingArgs = [first || last, order, last ? before : after];

  if (obj instanceof Ledger) {
    data = await dataSource.getLedgerTransactions(obj.id, ...pagingArgs);
  } else if (obj instanceof Account) {
    data = await dataSource.getAccountTransactions(obj.id, ...pagingArgs);
  } else {
    throw new Error(`Cannot fetch operations for ${obj.constructor}`);
  }

  // we must keep descending ordering, because Horizon doesn't do it,
  // when you request the previous page
  if (first && after) {
    data = data.reverse();
  }

  const edges = data.map((record: IHorizonTransactionData) => {
    return {
      node: TransactionWithXDRFactory.fromHorizon(record),
      cursor: record.paging_token
    };
  });

  return {
    nodes: edges.map((edge: { node: Transaction; cursor: string }) => edge.node),
    edges,
    pageInfo: {
      startCursor: data.length !== 0 ? data[0].paging_token : null,
      endCursor: data.length !== 0 ? data[data.length - 1].paging_token : null
    }
  };
}
