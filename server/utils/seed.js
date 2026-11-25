/**
 * Demo data for local development and the Docker stack: an admin, a staff member, a verified
 * customer, a catalogue across every category and one active discount.
 *
 *   npm run seed            # skips if products already exist
 *   npm run seed -- --fresh # wipes the demo collections first
 *
 * Demo accounts all use the password from SEED_PASSWORD (default "Demo12345"). Never run this
 * against a production database.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Discount from '../models/Discount.js';
import Cart from '../models/Cart.js';
import Order from '../models/Order.js';
import Appointment from '../models/Appointment.js';
import Wishlist from '../models/Wishlist.js';

dotenv.config();

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo data with NODE_ENV=production.');
  process.exit(1);
}

const password = process.env.SEED_PASSWORD || 'Demo12345';
const fresh = process.argv.includes('--fresh');

const products = [
  ['Dell Latitude 7490 (i7, 16GB, 512GB SSD)', 'laptops', 'excellent', 145000, 6, 'Dell'],
  ['Lenovo ThinkPad T480 (i5, 8GB, 256GB SSD)', 'laptops', 'good', 98000, 9, 'Lenovo'],
  ['MacBook Air 2017 (8GB, 128GB)', 'laptops', 'fair', 120000, 2, 'Apple'],
  ['HP EliteBook 840 G5', 'laptops', 'good', 110000, 0, 'HP'],
  ['iPhone 11 64GB', 'smartphones', 'good', 115000, 4, 'Apple'],
  ['Samsung Galaxy S10', 'smartphones', 'fair', 62000, 7, 'Samsung'],
  ['Google Pixel 4a', 'smartphones', 'excellent', 58000, 3, 'Google'],
  ['Apple Watch Series 5 (44mm)', 'wearables', 'good', 52000, 5, 'Apple'],
  ['Fitbit Charge 4', 'wearables', 'excellent', 14500, 12, 'Fitbit'],
  ['iPad 7th Gen 32GB', 'tablets', 'good', 72000, 4, 'Apple'],
  ['Samsung Galaxy Tab A 10.1', 'tablets', 'fair', 39000, 6, 'Samsung'],
  ['Logitech MX Master 2S Mouse', 'accessories', 'excellent', 9500, 15, 'Logitech'],
  ['USB-C 65W Laptop Charger', 'accessories', 'good', 4500, 25, 'Generic'],
  ['Mechanical Keyboard (refurbished)', 'accessories', 'good', 11000, 8, 'Keychron'],
];

await mongoose.connect(process.env.MONGODB_URI);

try {
  if (fresh) {
    await Promise.all([User, Product, Discount, Cart, Order, Appointment, Wishlist].map((m) => m.deleteMany({})));
    console.log('🧹 Cleared demo collections');
  } else if (await Product.estimatedDocumentCount()) {
    console.log('ℹ️  Products already exist, skipping seed (use --fresh to reset).');
    process.exit(0);
  }

  const accounts = [
    { name: 'Demo Admin', email: 'admin@retechex.local', role: 'admin' },
    { name: 'Demo Staff', email: 'staff@retechex.local', role: 'staff', assignedBranch: 'Colombo Fort' },
    { name: 'Demo Customer', email: 'customer@retechex.local', role: 'customer', phone: '0771234567' },
  ];
  for (const account of accounts) {
    // create() (not insertMany) so the password pre-save hook hashes each password.
    await User.create({ ...account, password, isVerified: true, isActive: true });
  }

  const created = await Product.insertMany(
    products.map(([name, category, condition, price, stockQuantity, brand]) => ({
      name,
      category,
      condition,
      price,
      stockQuantity,
      brand,
      status: stockQuantity > 0 ? 'listed' : 'out_of_stock',
      description: `Refurbished ${name}, tested and cleaned by ReTechEx technicians. Includes a 3-month warranty.`,
    })),
  );

  await Discount.create({
    name: 'Back to campus',
    description: '10% off a refurbished ThinkPad',
    type: 'percentage',
    value: 10,
    scope: 'product',
    productId: created[1]._id,
    startDate: new Date(Date.now() - 60_000),
    endDate: new Date(Date.now() + 30 * 86_400_000),
  });

  console.log(`✅ Seeded ${accounts.length} users, ${created.length} products and 1 discount.`);
  console.log(`   Logins: ${accounts.map((a) => a.email).join(', ')} (password from SEED_PASSWORD)`);
} finally {
  await mongoose.disconnect();
}
