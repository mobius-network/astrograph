import _ from "lodash";
import { Connection } from "../connection";
import { FiltersBuilder } from "./operations/filters_builder";
import { queryPredicates } from "./operations/predicates";

import { IAssetInput, Operation, OperationKinds } from "../../model";
import { OperationFactory } from "../../model/factories";

import { AccountID } from "../../model/account_id";
import { AssetCode } from "../../model/asset_code";
import { Query } from "./query";

// What filters for different operations we provide
export interface ISetOptionsOpsQueryParams {
  masterWeight: number;
  account: AccountID;
}

export interface IPaymentsQueryParams {
  asset: IAssetInput | null;
  destination: AccountID | null;
  source: AccountID | null;
}

export interface IAccountMergeQueryParams {
  destination: AccountID | null;
}

export interface IAllowTrustQueryParams {
  authorize: boolean;
  assetCode: AssetCode;
  trustor: AccountID;
}

export interface IBumpSequenceQueryParams {
  bumpTo: number;
}

export interface IChangeTrustQueryParams {
  limit: string;
  asset: IAssetInput;
}

export interface ICreateAccountQueryParams {
  destination: AccountID;
}

export interface IManageDataQueryParams {
  name: string;
  value: string;
}

export interface IManageOfferQueryParams {
  offerId: string;
  assetSelling: IAssetInput;
  assetBuying: IAssetInput;
}

export interface IPathPaymentsQueryParams {
  sourceAccount: AccountID;
  destinationAccount: AccountID;
  destinationAsset: IAssetInput;
  sourceAsset: IAssetInput;
  pathContains: IAssetInput;
}

interface IOperationsQueryParams {
  [OperationKinds.Payment]?: IPaymentsQueryParams;
  [OperationKinds.SetOption]?: ISetOptionsOpsQueryParams;
  [OperationKinds.AccountMerge]?: IAccountMergeQueryParams;
  [OperationKinds.AllowTrust]?: IAllowTrustQueryParams;
  [OperationKinds.ChangeTrust]?: IChangeTrustQueryParams;
  [OperationKinds.CreateAccount]?: ICreateAccountQueryParams;
  [OperationKinds.ManageData]?: IManageDataQueryParams;
  [OperationKinds.ManageOffer]?: IManageOfferQueryParams;
  [OperationKinds.PathPayment]?: IPathPaymentsQueryParams;
}

type IOperationsQueryResult = Operation[];

export class OperationsQuery extends Query<IOperationsQueryResult> {
  private offset: number;
  private kinds: OperationKinds[];
  private filters: IOperationsQueryParams;

  constructor(
    connection: Connection,
    private accountID: string,
    kinds: OperationKinds[],
    filters: IOperationsQueryParams,
    private first: number,
    offset?: number
  ) {
    super(connection);
    this.offset = offset || 0;
    this.kinds = kinds || Object.keys(OperationKinds).map(k => OperationKinds[k]);
    this.filters = filters || {};
  }

  public async call(): Promise<IOperationsQueryResult> {
    const r = await this.request();
    if (!r.ops) {
      return [];
    }
    return r.ops.map(OperationFactory.fromDgraph);
  }

  protected async request(): Promise<any> {
    let query = "query operations($first: int, $offset: int) {";

    this.kinds.forEach(opKind => {
      const filters = FiltersBuilder.build(opKind, this.filters[opKind] || {});

      query += `
        ${opKind} as var(func: has(${opKind})) ${filters.root} @cascade {
          ${filters.nested}
          ${this.accountID ? `account.source @filter(eq(id, ${this.accountID}))` : ""}
        }
      `;
    });

    query += `
        ops(func: uid(${this.kinds.join()}), first: $first, offset: $offset, orderdesc: order) {
          kind
          index
          ledger { close_time }
          transaction { id }
          account.source { id }
          ${_
            .chain(this.kinds)
            .map(opKind => queryPredicates[opKind])
            .flatten()
            .uniq()
            .value()
            .join("\n")}
        }
      }
    `;

    return this.connection.query(query, {
      $first: this.first.toString(),
      $offset: this.offset.toString()
    });
  }
}
