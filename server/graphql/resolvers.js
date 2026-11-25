import { GraphQLError } from 'graphql';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Order from '../models/Order.js';

const MAX_PAGE_SIZE = 50;

const badInput = (message) => new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });

const SORTS = {
  NEWEST: { createdAt: -1 },
  PRICE_ASC: { price: 1 },
  PRICE_DESC: { price: -1 },
  NAME: { name: 1 },
};

const finalPrice = (price, discount) => {
  if (!discount) return price;
  return discount.type === 'percentage'
    ? Math.round(price * (1 - discount.value / 100) * 100) / 100
    : Math.max(0, price - discount.value);
};

export const resolvers = {
  Query: {
    async products(_, { filter = {}, sort, page, pageSize }) {
      if (page < 1) throw badInput('page must be 1 or more');
      if (pageSize < 1 || pageSize > MAX_PAGE_SIZE) throw badInput(`pageSize must be between 1 and ${MAX_PAGE_SIZE}`);
      if (filter.search && filter.search.length > 100) throw badInput('search is too long');
      if (filter.minPrice != null && filter.maxPrice != null && filter.minPrice > filter.maxPrice) {
        throw badInput('minPrice cannot be greater than maxPrice');
      }

      // The storefront only ever exposes listed products.
      const query = { status: 'listed' };
      if (filter.search) query.$text = { $search: filter.search };
      if (filter.category) query.category = filter.category;
      if (filter.condition) query.condition = filter.condition;
      if (filter.minPrice != null || filter.maxPrice != null) {
        query.price = {};
        if (filter.minPrice != null) query.price.$gte = filter.minPrice;
        if (filter.maxPrice != null) query.price.$lte = filter.maxPrice;
      }

      const [items, total] = await Promise.all([
        Product.find(query)
          .sort(SORTS[sort])
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .lean(),
        Product.countDocuments(query),
      ]);

      return { items, total, page, pageSize, hasNextPage: page * pageSize < total };
    },

    async product(_, { id }, { loaders }) {
      if (!mongoose.isValidObjectId(id)) throw badInput('Invalid product id');
      const product = await loaders.productById.load(id);
      return product?.status === 'listed' ? product : null;
    },

    async categories() {
      const rows = await Product.aggregate([
        { $match: { status: 'listed' } },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            minPrice: { $min: '$price' },
            maxPrice: { $max: '$price' },
          },
        },
        { $sort: { _id: 1 } },
      ]);
      return rows.map((r) => ({ category: r._id, count: r.count, minPrice: r.minPrice, maxPrice: r.maxPrice }));
    },

    me(_, __, { user }) {
      return user ?? null;
    },
  },

  Me: {
    id: (user) => String(user._id),
    async orders(user, { limit }) {
      if (limit < 1 || limit > 50) throw badInput('limit must be between 1 and 50');
      return Order.find({ user: user._id }).sort({ createdAt: -1 }).limit(limit).lean();
    },
  },

  Product: {
    id: (p) => String(p._id),
    images: (p) => p.images ?? [],
    inStock: (p) => p.stockQuantity > 0,
    discount: (p, _, { loaders }) => loaders.activeDiscountByProductId.load(String(p._id)),
    async finalPrice(p, _, { loaders }) {
      return finalPrice(p.price, await loaders.activeDiscountByProductId.load(String(p._id)));
    },
  },

  Discount: {
    endsAt: (d) => new Date(d.endDate).toISOString(),
  },

  Order: {
    id: (o) => String(o._id),
    createdAt: (o) => new Date(o.createdAt).toISOString(),
  },

  OrderItem: {
    // Batched: all items across all orders in this response share one Product query.
    product: (item, _, { loaders }) => (item.product ? loaders.productById.load(String(item.product)) : null),
    lineTotal: (item) => item.price * item.quantity,
  },
};
