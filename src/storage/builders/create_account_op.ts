import { publicKeyFromBuffer } from "../../util/xdr/account";
import { IBlank, NQuads } from "../nquads";
import { AccountBuilder } from "./account";
import { Builder } from "./builder";

export class CreateAccountOpBuilder extends Builder {
  constructor(public readonly current: IBlank, private xdr: any) {
    super();
  }

  public build(): NQuads {
    const startingBalance = this.xdr.startingBalance().toString();
    const destination = publicKeyFromBuffer(this.xdr.destination().value());

    this.pushValue("starting_balance", startingBalance);
    this.pushBuilder(new AccountBuilder(destination), "account.destination", "operations");

    return this.nquads;
  }
}