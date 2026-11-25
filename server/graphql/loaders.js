import DataLoader from 'dataloader';
import Product from '../models/Product.js';
import Discount from '../models/Discount.js';

/**
 * Per-request DataLoaders. Without them, listing 10 orders with 3 items each would run 30
 * separate Product.findById queries (the classic GraphQL N+1 problem). DataLoader collects
 * every id requested in the same tick and loads them with ONE `$in` query, and caches each
 * product for the rest of the request.
 */
export function createLoaders() {
  return {
    productById: new DataLoader(async (ids) => {
      const docs = await Product.find({ _id: { $in: ids } }).lean();
      const byId = new Map(docs.map((d) => [String(d._id), d]));
      return ids.map((id) => byId.get(String(id)) ?? null);
    }),

    /** Currently valid product-level discount for each product id (or null). */
    activeDiscountByProductId: new DataLoader(async (productIds) => {
      const now = new Date();
      const discounts = await Discount.find({
        productId: { $in: productIds },
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
      }).lean();
      const byProduct = new Map(discounts.map((d) => [String(d.productId), d]));
      return productIds.map((id) => byProduct.get(String(id)) ?? null);
    }),
  };
}
