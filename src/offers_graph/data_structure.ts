import { BigNumber } from "bignumber.js";
import { AssetID } from "../model";
import { Offer } from "../orm/entities";
import logger from "../util/logger";
import { IOrder, OrderBook } from "./orderbook";

interface IEdgeData {
  capacity: BigNumber;
  orderBook: OrderBook;
}

interface IEdge {
  vertex: AssetID;
  data: IEdgeData;
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
      const order: IOrder = { amount: offer.amount, price: offer.price };

      if (!edge) {
        this.addEdge(assetToSell, assetToBuy, {
          capacity: offer.amount,
          orderBook: new OrderBook([order])
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
    const orderBook = new OrderBook();

    for (const { amount, price } of offers) {
      orderBook.addOrder({ amount, price });
      capacity = capacity.plus(amount);
    }

    this.updateEdge(selling, buying, { capacity, orderBook });
    this.sortOrderBooks();
  }

  public getEdges(from: AssetID) {
    return this.edges.get(from);

    // return JSON.parse(JSON.stringify(edges), (key, value) => {
    //   if (key === "capacity") {
    //     return new BigNumber(value);
    //   }

    //   if (key === "orderBook") {
    //   }

    //   return value;
    // }); // cloning
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
