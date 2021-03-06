import { BigNumber } from "bignumber.js";
import { AssetID } from "../../model";
import { Offer } from "../../orm/entities";
import logger from "../../util/logger";

interface IEdgeData {
  capacity: BigNumber;
  orderBook: AssetOrders;
}

interface IEdge {
  vertex: AssetID;
  data: IEdgeData;
}

class AssetOrder {
  public readonly amount: BigNumber;
  public readonly price: BigNumber; // we use it just for sorting
  public readonly priceN: number;
  public readonly priceD: number;

  constructor(offer: Offer) {
    this.amount = offer.amount;
    this.price = offer.price;
    this.priceD = offer.priceD;
    this.priceN = offer.priceN;
  }

  public get sellingBound() {
    if (this.priceN > this.priceD) {
      return this.amount;
    }

    return this.amount
      .times(this.priceN)
      .div(this.priceD)
      .integerValue(BigNumber.ROUND_FLOOR)
      .times(this.priceD)
      .div(this.priceN)
      .integerValue(BigNumber.ROUND_CEIL);
  }
}

class AssetOrders {
  constructor(private readonly orders: AssetOrder[] = []) {}

  public getOrders() {
    // return copy of the orders
    return this.orders.map(o => o);
  }

  public addOrder(order: AssetOrder): void {
    this.orders.push(order);
  }

  public sort() {
    this.orders.sort((a, b) => a.price.comparedTo(b.price));
  }

  public buy(amountToBuy: BigNumber): BigNumber {
    let amountToSell = new BigNumber(0);

    for (const order of this.orders) {
      const amount = order.sellingBound;
      const { priceN, priceD } = order;

      if (amountToBuy.gt(amount)) {
        amountToSell = amountToSell.plus(amount.times(priceN).div(priceD));
        amountToBuy = amountToBuy.minus(amount);
      } else {
        amountToSell = amountToSell.plus(amountToBuy.times(priceN).div(priceD));
        break;
      }
    }

    return amountToSell;
  }
}

export class OffersGraph {
  public static build(offers: Offer[]) {
    const graph = new OffersGraph();
    graph.build(offers);

    return graph;
  }

  private readonly edges: Map<AssetID, IEdge[]>;

  constructor() {
    this.edges = new Map<AssetID, IEdge[]>();
  }

  public build(offers: Offer[]) {
    for (const offer of offers) {
      const [assetToBuy, assetToSell] = [offer.buying, offer.selling];

      const edge = this.getEdgeData(assetToSell, assetToBuy);
      const order = new AssetOrder(offer);

      if (!edge) {
        this.addEdge(assetToSell, assetToBuy, {
          capacity: offer.amount,
          orderBook: new AssetOrders([order])
        });
      } else {
        edge.orderBook.addOrder(order);

        this.updateEdge(assetToSell, assetToBuy, {
          capacity: edge.capacity.plus(offer.amount),
          orderBook: edge.orderBook
        });
      }
    }

    this.sortOrderBooks();
  }

  public update(selling: AssetID, buying: AssetID, offers: Offer[]): void {
    if (offers.length === 0) {
      this.dropEdge(selling, buying);
      return;
    }

    let capacity = new BigNumber(0);
    const orderBook = new AssetOrders();

    for (const offer of offers) {
      orderBook.addOrder(new AssetOrder(offer));
      capacity = capacity.plus(offer.amount);
    }

    this.updateEdge(selling, buying, { capacity, orderBook });
    this.sortOrderBooks();
  }

  public getEdges(from: AssetID) {
    return this.edges.get(from);
  }

  public addEdge(from: AssetID, to: AssetID, data: IEdgeData): void {
    const edge = this.getEdge(from, to);

    if (edge) {
      throw new Error(`Edge between ${from} and ${to} already exists. Use \`updateEdge\` to overwrite`);
    }

    const edges = this.edges.get(from);

    if (!edges) {
      this.edges.set(from, [{ vertex: to, data }]);
    } else {
      edges.push({ vertex: to, data });
    }
  }

  public updateEdge(from: AssetID, to: AssetID, data: IEdgeData): void {
    const edge = this.getEdge(from, to);

    if (!edge) {
      return;
    }

    edge.data = data;
  }

  public getEdgeData(from: AssetID, to: AssetID): IEdgeData | undefined {
    const edge = this.getEdge(from, to);
    return edge ? edge.data : undefined;
  }

  public dropEdge(from: AssetID, to: AssetID): void {
    const edges = this.edges.get(from);

    if (!edges) {
      return;
    }

    const indexToDrop = edges.findIndex(e => e.vertex === to);

    if (indexToDrop === -1) {
      logger.warn("Graph seems to be inconsistent");
      return;
    }

    edges.splice(indexToDrop, 1);
    this.edges.set(from, edges);
  }

  private sortOrderBooks() {
    this.edges.forEach(edges => {
      edges.forEach(edge => edge.data.orderBook.sort());
    });
  }

  private getEdge(from: AssetID, to: AssetID) {
    const edges = this.edges.get(from);

    if (!edges) {
      return;
    }

    return edges.find(e => e.vertex === to);
  }
}
