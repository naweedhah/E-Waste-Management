import { describe, expect, it } from 'vitest';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Discount from '../models/Discount.js';
import { address, api, fillCart, makeProduct, makeUser } from './helpers.js';

const checkout = async (auth, body = { shippingAddress: address }) =>
  (await api()).post('/api/orders').set(auth).send(body);

describe('checkout', () => {
  it('creates the order at the database price and decrements stock', async () => {
    const { user, auth } = await makeUser();
    const laptop = await makeProduct({ price: 150000, stockQuantity: 3 });
    // Tampered cart price must be ignored.
    await fillCart(user, [{ product: { ...laptop.toObject(), price: 1 }, quantity: 2 }]);

    const res = await checkout(auth);

    expect(res.status).toBe(201);
    expect(res.body.order.totalAmount).toBe(300000);
    expect((await Product.findById(laptop._id)).stockQuantity).toBe(1);
  });

  it('applies an active product discount', async () => {
    const { user, auth } = await makeUser();
    const phone = await makeProduct({ category: 'smartphones', price: 50000 });
    await Discount.create({
      name: 'Launch week',
      type: 'percentage',
      value: 10,
      scope: 'product',
      productId: phone._id,
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 86_400_000),
    });
    await fillCart(user, [{ product: phone, quantity: 1 }]);

    const res = await checkout(auth);

    expect(res.status).toBe(201);
    expect(res.body.order.totalAmount).toBe(45000);
  });

  it('never oversells the last unit when two customers check out at the same time', async () => {
    const lastOne = await makeProduct({ stockQuantity: 1 });
    const buyers = await Promise.all([makeUser(), makeUser(), makeUser(), makeUser()]);
    await Promise.all(buyers.map(({ user }) => fillCart(user, [{ product: lastOne, quantity: 1 }])));

    const results = await Promise.all(buyers.map(({ auth }) => checkout(auth)));
    const statuses = results.map((r) => r.status).sort();

    expect(statuses).toEqual([201, 409, 409, 409]);
    const after = await Product.findById(lastOne._id);
    expect(after.stockQuantity).toBe(0);
    expect(after.status).toBe('out_of_stock');
    expect(await Order.countDocuments()).toBe(1);
  });

  it('reserves all lines or none: a sold-out second item puts the first one back', async () => {
    const { user, auth } = await makeUser();
    const inStock = await makeProduct({ stockQuantity: 5 });
    const soldOut = await makeProduct({ stockQuantity: 1 });
    await fillCart(user, [
      { product: inStock, quantity: 2 },
      { product: soldOut, quantity: 3 },
    ]);

    const res = await checkout(auth);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/sold out|fewer items/);
    expect((await Product.findById(inStock._id)).stockQuantity).toBe(5);
    expect((await Product.findById(soldOut._id)).stockQuantity).toBe(1);
    expect(await Order.countDocuments()).toBe(0);
  });

  it('requires a verified email address', async () => {
    const { user, auth } = await makeUser({ isVerified: false });
    await fillCart(user, [{ product: await makeProduct(), quantity: 1 }]);

    const res = await checkout(auth);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('validates the shipping address and payment method', async () => {
    const { auth } = await makeUser();

    const res = await checkout(auth, {
      shippingAddress: { street: '', city: 'C', zipCode: 'ABC' },
      paymentMethod: 'Bitcoin',
    });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields)).toEqual(
      expect.arrayContaining(['shippingAddress.street', 'shippingAddress.city', 'shippingAddress.zipCode', 'paymentMethod']),
    );
  });

  it('returns 400 (not 500) for a malformed order id and 403 for someone else\'s order', async () => {
    const owner = await makeUser();
    const other = await makeUser();
    await fillCart(owner.user, [{ product: await makeProduct(), quantity: 1 }]);
    const orderId = (await checkout(owner.auth)).body.order._id;

    expect((await (await api()).get('/api/orders/not-an-id').set(owner.auth)).status).toBe(400);
    expect((await (await api()).get(`/api/orders/${orderId}`).set(other.auth)).status).toBe(403);
    expect((await (await api()).get(`/api/orders/${orderId}`).set(owner.auth)).status).toBe(200);
  });
});

describe('staff stock adjustments', () => {
  it('are atomic and cannot push stock below zero', async () => {
    const { auth } = await makeUser({ role: 'staff', assignedBranch: 'Colombo Fort' });
    const item = await makeProduct({ stockQuantity: 10 });
    const http = await api();

    // Ten concurrent "+1" restocks must all count (no lost updates).
    await Promise.all(
      Array.from({ length: 10 }, () =>
        http.patch(`/api/products/${item._id}/stock`).set(auth).send({ action: 'increment', quantity: 1 }),
      ),
    );
    expect((await Product.findById(item._id)).stockQuantity).toBe(20);

    const tooMany = await http.patch(`/api/products/${item._id}/stock`).set(auth).send({ action: 'decrement', quantity: 21 });
    expect(tooMany.status).toBe(409);
    expect((await Product.findById(item._id)).stockQuantity).toBe(20);
  });
});
