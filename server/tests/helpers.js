import request from 'supertest';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Cart from '../models/Cart.js';
import { generateToken } from '../middleware/auth.js';
import { createApp } from '../app.js';

let appPromise;
export const getApp = () => (appPromise ??= createApp());
export const api = async () => request(await getApp());

let seq = 0;

export async function makeUser(overrides = {}) {
  seq += 1;
  const user = await User.create({
    name: `Test User ${seq}`,
    email: `user${seq}@example.com`,
    password: 'Password123',
    phone: '0771234567',
    role: 'customer',
    isVerified: true,
    ...overrides,
  });
  return { user, token: generateToken(user._id), auth: { Authorization: `Bearer ${generateToken(user._id)}` } };
}

export async function makeProduct(overrides = {}) {
  seq += 1;
  return Product.create({
    name: `Refurbished Laptop ${seq}`,
    category: 'laptops',
    condition: 'good',
    price: 100000,
    stockQuantity: 5,
    status: 'listed',
    ...overrides,
  });
}

export async function fillCart(user, lines) {
  return Cart.create({
    user: user._id,
    items: lines.map(({ product, quantity }) => ({ product: product._id, quantity, priceAtAdd: product.price })),
  });
}

export const address = { street: '12 Galle Road', city: 'Colombo', zipCode: '00300' };

/** yyyy-mm-dd for `days` from today in local time (what the booking form sends). */
export const dayFromNow = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
