import { afterEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import Discount from '../models/Discount.js';
import Order from '../models/Order.js';
import { api, makeProduct, makeUser } from './helpers.js';

const gql = async (query, variables = {}, headers = {}) =>
  (await api()).post('/graphql').set({ 'Content-Type': 'application/json', ...headers }).send({ query, variables });

describe('GraphQL catalogue', () => {
  it('pages through listed products only, with discounted final prices', async () => {
    const watch = await makeProduct({ name: 'Galaxy Watch', category: 'wearables', price: 40000 });
    await makeProduct({ name: 'Pixel Watch', category: 'wearables', price: 60000 });
    await makeProduct({ name: 'Hidden Watch', category: 'wearables', status: 'unlisted' });
    await makeProduct({ name: 'ThinkPad', category: 'laptops' });
    await Discount.create({
      name: 'Clearance',
      type: 'fixed',
      value: 5000,
      scope: 'product',
      productId: watch._id,
      startDate: new Date(Date.now() - 1000),
      endDate: new Date(Date.now() + 86_400_000),
    });

    const res = await gql(
      `query ($filter: ProductFilter, $page: Int, $pageSize: Int) {
        products(filter: $filter, sort: PRICE_ASC, page: $page, pageSize: $pageSize) {
          total hasNextPage items { name price finalPrice discount { name } inStock }
        }
      }`,
      { filter: { category: 'wearables' }, page: 1, pageSize: 1 },
    );

    expect(res.body.errors).toBeUndefined();
    const page = res.body.data.products;
    expect(page.total).toBe(2);
    expect(page.hasNextPage).toBe(true);
    expect(page.items[0]).toEqual({
      name: 'Galaxy Watch',
      price: 40000,
      finalPrice: 35000,
      discount: { name: 'Clearance' },
      inStock: true,
    });
  });

  it('rejects bad input with BAD_USER_INPUT instead of crashing', async () => {
    const tooBig = await gql('{ products(pageSize: 500) { total } }');
    const badId = await gql('{ product(id: "123") { name } }');

    expect(tooBig.body.errors[0].extensions.code).toBe('BAD_USER_INPUT');
    expect(badId.body.errors[0].extensions.code).toBe('BAD_USER_INPUT');
  });

  it('refuses queries nested deeper than the limit', async () => {
    const res = await gql('{ me { orders { items { product { discount { name } } } } } }');
    // me(1) orders(2) items(3) product(4) discount(5) name(6) is allowed; one more level is not.
    expect(res.body.errors).toBeUndefined();

    const deep = await gql('{ me { orders { items { product { discount { name } } } } } } fragment F on Product { discount { name } }');
    expect(deep.status).toBe(400);
  });
});

describe('GraphQL "me"', () => {
  const queries = [];
  const record = (collection, method) => queries.push(`${collection}.${method}`);

  afterEach(() => {
    mongoose.set('debug', false);
    queries.length = 0;
  });

  it('is null when anonymous', async () => {
    const res = await gql('{ me { name } }');
    expect(res.body.data.me).toBeNull();
  });

  it("returns only the caller's orders and batches product lookups (no N+1)", async () => {
    const { user, auth } = await makeUser();
    const other = await makeUser();
    const products = await Promise.all([makeProduct(), makeProduct(), makeProduct()]);
    const order = (owner, n) =>
      Order.create({
        orderNumber: `ORD-TEST-${owner._id}-${n}`,
        user: owner._id,
        items: products.map((p) => ({ product: p._id, name: p.name, quantity: 1, price: p.price })),
        totalAmount: 300000,
        shippingAddress: { street: '1 Main St', city: 'Colombo' },
      });
    await Promise.all([order(user, 1), order(user, 2), order(user, 3), order(other.user, 1)]);

    mongoose.set('debug', (collection, method) => record(collection, method));
    const res = await gql('{ me { name orders { orderNumber items { lineTotal product { name } } } } }', {}, auth);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.me.orders).toHaveLength(3);
    expect(res.body.data.me.orders.every((o) => o.orderNumber.includes(String(user._id)))).toBe(true);
    // 3 orders x 3 items = 9 product references, loaded with a single query.
    expect(queries.filter((q) => q.startsWith('products.find'))).toHaveLength(1);
  });
});
