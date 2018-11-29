import dig from "object-dig";
import { Asset } from "stellar-sdk";
import { buildAssetFilter } from "../../util/queries/asset_filter";
import { Connection } from "../connection";
import { Query } from "./query";

type ILastTrustLineEntryQueryResult = string | null;

export class LastTrustLineEntryQuery extends Query<ILastTrustLineEntryQueryResult> {
  constructor(connection: Connection, private asset: Asset, private accountID: string) {
    super(connection);
  }

  public async call(): Promise<ILastTrustLineEntryQueryResult> {
    const r = await this.request();
    const data = dig(r, "last_entry", 0);
    if (!data) {
      return null;
    }
    return data.key;
  }

  protected async request(): Promise<any> {
    const query = `
      query lastTrustLineEntry($id: string) {
        A as var(func: eq(type, "trust_line_entry")) @cascade {
          ${buildAssetFilter(this.asset.getCode(), this.asset.getIssuer())}
          account @filter(eq(id, $id)) { account: id }
        }

        last_entry(func: uid(A), first: 1, orderdesc: order) {
          key
        }
      }
    `;

    return this.connection.query(query, { $id: this.accountID });
  }
}