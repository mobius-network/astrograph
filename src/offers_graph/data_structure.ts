import { BigNumber } from "bignumber.js";
import { AssetID } from "../model";
import { Offer } from "../orm/entities";
import { buy, Order, OrderBook } from "./orderbook";

interface IEdgeData {
  capacity: BigNumber;
  orderBook: OrderBook;
}

const maxPathLength = 7 - 1;

export class OffersGraph {
  public static build(offers: Offer[]) {
    const graph = new OffersGraph();
    graph.build(offers);

    return graph;
  }

  private readonly adjacencyList: Map<AssetID, AssetID[]>;
  private readonly edges: Map<string, IEdgeData>;

  constructor() {
    this.adjacencyList = new Map<AssetID, AssetID[]>();
    this.edges = new Map<string, IEdgeData>();
  }

  public build(offers: Offer[]) {
    for (const offer of offers) {
      const [assetToBuy, assetToSell] = [offer.buying, offer.selling];

      const edge = this.getEdgeData(assetToSell, assetToBuy);
      const order: Order = [offer.amount, offer.price];

      if (!edge) {
        this.addEdge(assetToSell, assetToBuy, {
          capacity: offer.amount,
          orderBook: [order]
        });
      } else {
        this.updateEdge(assetToSell, assetToBuy, {
          capacity: edge.capacity.plus(offer.amount),
          orderBook: edge.orderBook.concat([order])
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
    const orderBook: OrderBook = [];

    for (const offer of offers) {
      orderBook.push([offer.amount, offer.price]);
      capacity = capacity.plus(offer.amount);
    }

    this.updateEdge(selling, buying, { capacity, orderBook });
    this.sortOrderBooks();
  }

  public findPaths(targetAssets: AssetID[], destAsset: AssetID, destAmount: BigNumber) {
    // take a short-cut if we're trying to find a path from ["native"] to "native":
    if (destAsset === "native" && targetAssets.length === 1) {
      return { native: [[destAmount, []]] };
    }

    // the lowest cost so far for a path going from an asset to `destAsset`
    const lowestCost = new Map<AssetID, BigNumber>();

    // the paths found for each individual target asset
    const paths = {};
    for (const asset of targetAssets) {
      paths[asset] = [];
    }

    // take a short-cut if `destAssset` is one of the target assets,
    // and add a direct path already from the start
    if (targetAssets.includes(destAsset)) {
      paths[destAsset].push([destAmount, []]);
      lowestCost.set(destAsset, destAmount);
    }

    // the current path being checked
    const path: string[] = [];

    const find = (nextAsset: AssetID, amountIn: BigNumber) => {
      if (path.includes(nextAsset)) {
        return;
      }

      // if we get to an a point where we've come to in a previous path
      // and that path has a lower cost than this one, then there's no point
      // in traversing any further

      const cost = lowestCost.get(nextAsset);
      if (!cost || amountIn.lt(cost)) {
        lowestCost.set(nextAsset, amountIn);
      } else {
        return;
      }

      // if the current asset is one of our target assets,
      // store away the path we've taken to get here
      if (nextAsset in paths) {
        paths[nextAsset].push([amountIn, path.slice(1).reverse()]);
      }

      // if we're at the maximum path length (`path` + `destAsset`),
      // stop searching
      if (path.length === maxPathLength) {
        return;
      }

      // fan out
      const edges = this.getEdges(nextAsset);

      if (edges.length !== 0) {
        path.push(nextAsset);

        for (const edge of edges) {
          if (edge.data.capacity.gte(amountIn)) {
            const amountOut = buy(edge.data.orderBook, amountIn);
            find(edge.vertex, amountOut);
          }
        }

        path.pop();
      }
    };

    find(destAsset, destAmount);

    return paths;
  }

  public addEdge(from: AssetID, to: AssetID, data: IEdgeData): void {
    if (this.edges.has(`${from}->${to}`)) {
      throw new Error(`Edge between ${from} and ${to} already exists. Use \`updateEdge\` to overwrite`);
    }

    this.updateEdge(from, to, data);
  }

  public updateEdge(from: AssetID, to: AssetID, data: IEdgeData): void {
    const adjacent = this.adjacencyList.get(from);

    if (!adjacent) {
      this.adjacencyList.set(from, [to]);
    } else {
      this.adjacencyList.set(from, adjacent.concat(to));
    }

    this.edges.set(`${from}->${to}`, data);
  }

  public getEdgeData(from: AssetID, to: AssetID): IEdgeData | undefined {
    return this.edges.get(`${from}->${to}`);
  }

  public getEdges(from: AssetID): Array<{ vertex: AssetID; data: IEdgeData }> {
    const adjacent = this.adjacencyList.get(from);

    if (!adjacent) {
      return [];
    }

    return adjacent.map(to => {
      const data = this.getEdgeData(from, to);
      return { vertex: to, data: data! };
    });
  }

  public dropEdge(from: AssetID, to: AssetID): void {
    this.edges.delete(`${from}->${to}`);
    const adjacent = this.adjacencyList.get(from);

    if (!adjacent) {
      return;
    }

    const indexToDrop = adjacent.findIndex(el => el === to);

    if (indexToDrop === -1) {
      console.warn("Graph seems to be inconsistent");
      return;
    }

    adjacent.splice(indexToDrop, 1);
    this.adjacencyList.set(from, adjacent);
  }

  private sortOrderBooks() {
    this.edges.forEach((data, edge, map) => {
      data.orderBook.sort((a, b) => a[1].comparedTo(b[1]));
      map.set(edge, data);
    });
  }
}
