import Product from '../models/Product.js';

/**
 * Stock changes that stay correct under concurrent requests.
 *
 * The old checkout read the stock, checked it in JavaScript and decremented it later. Two
 * customers buying the last laptop at the same moment could both pass the check and the stock
 * would go negative (overselling). Here the check and the decrement are one atomic MongoDB
 * update: `{ stockQuantity: { $gte: qty } }` in the filter means the write only happens if
 * enough stock is still there at the moment of writing.
 *
 * A multi-item order reserves items one by one; if any item cannot be reserved, the items
 * already reserved are put back (a compensating update), so a failed checkout never leaves
 * stock missing. This works on a standalone MongoDB as well as on a replica set.
 */

export class InsufficientStockError extends Error {
  constructor(productName) {
    super(`Sorry, "${productName}" just sold out or has fewer items left than you requested.`);
    this.name = 'InsufficientStockError';
    this.statusCode = 409;
  }
}

/** Atomically takes `quantity` units of one product, or returns null if it cannot. */
export async function takeStock(productId, quantity) {
  return Product.findOneAndUpdate(
    { _id: productId, status: 'listed', stockQuantity: { $gte: quantity } },
    { $inc: { stockQuantity: -quantity, sales: quantity } },
    { new: true },
  );
}

/** Puts units back (used for compensation and for cancelled orders). */
export async function returnStock(productId, quantity, { undoSale = true } = {}) {
  return Product.findByIdAndUpdate(
    productId,
    { $inc: { stockQuantity: quantity, ...(undoSale ? { sales: -quantity } : {}) } },
    { new: true },
  );
}

/**
 * Reserves every line of an order or none of them.
 * @param {{ product: string, name: string, quantity: number }[]} lines
 * @throws {InsufficientStockError}
 */
export async function reserveStock(lines) {
  const reserved = [];

  for (const line of lines) {
    const updated = await takeStock(line.product, line.quantity);
    if (!updated) {
      await releaseStock(reserved);
      throw new InsufficientStockError(line.name);
    }
    reserved.push(line);
    await markOutOfStock(updated);
  }

  return reserved;
}

export async function releaseStock(lines) {
  await Promise.all(lines.map((line) => returnStock(line.product, line.quantity)));
}

/** Staff restock / write-off without a read-modify-write race. */
export async function adjustStock(productId, action, quantity) {
  const update =
    action === 'increment'
      ? Product.findByIdAndUpdate(
          productId,
          { $inc: { stockQuantity: quantity }, $set: { lastRestocked: new Date() } },
          { new: true },
        )
      : Product.findOneAndUpdate(
          { _id: productId, stockQuantity: { $gte: quantity } },
          { $inc: { stockQuantity: -quantity } },
          { new: true },
        );

  const product = await update;
  if (!product) return null;
  await markOutOfStock(product);
  return Product.findById(product._id);
}

/** Keeps the listing status in sync with the stock level. */
async function markOutOfStock(product) {
  if (product.stockQuantity === 0 && product.status === 'listed') {
    await Product.updateOne({ _id: product._id, stockQuantity: 0 }, { $set: { status: 'out_of_stock' } });
  } else if (product.stockQuantity > 0 && product.status === 'out_of_stock') {
    await Product.updateOne({ _id: product._id }, { $set: { status: 'listed' } });
  }
}
