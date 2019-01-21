import { Asset } from "stellar-sdk";
import { AssetBuilder, SpecificOperationBuilder } from "../";
import { NQuads } from "../../nquads";

export class ChangeTrustOpBuilder extends SpecificOperationBuilder {
  public build(): NQuads {
    super.build();

    this.pushValue("limit", this.xdr.limit().toString());

    const asset = Asset.fromOperation(this.xdr.line());
    this.pushBuilder(new AssetBuilder(asset), "asset", "operations");

    return this.nquads;
  }

  protected pushResult() {
    const code = this.trXDR.changeTrustResult().switch().value;
    this.pushValue("change_trust_result_code", code);
  }
}
