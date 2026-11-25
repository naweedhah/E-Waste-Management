/**
 * Creates (or promotes) the first admin account.
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-strong-password' npm run create-admin
 *
 * The password is never hard-coded or printed. An existing account with that email is
 * promoted to admin instead of being deleted and recreated.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';

dotenv.config();

const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = 'System Admin' } = process.env;

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  fail('Set ADMIN_EMAIL and ADMIN_PASSWORD (in server/.env or the shell) before running this script.');
}
if (ADMIN_PASSWORD.length < 12 || !/[A-Za-z]/.test(ADMIN_PASSWORD) || !/\d/.test(ADMIN_PASSWORD)) {
  fail('ADMIN_PASSWORD must be at least 12 characters and contain a letter and a number.');
}

try {
  await mongoose.connect(process.env.MONGODB_URI);

  const email = ADMIN_EMAIL.trim().toLowerCase();
  let admin = await User.findOne({ email }).select('+password');

  if (admin) {
    admin.role = 'admin';
    admin.isActive = true;
    admin.isVerified = true;
    admin.password = ADMIN_PASSWORD; // re-hashed by the User pre-save hook
    await admin.save();
    console.log(`✅ Existing account ${email} promoted to admin and its password updated.`);
  } else {
    admin = await User.create({
      name: ADMIN_NAME,
      email,
      password: ADMIN_PASSWORD, // hashed by the User pre-save hook
      role: 'admin',
      isActive: true,
      isVerified: true,
    });
    console.log(`✅ Admin ${email} created.`);
  }
} catch (error) {
  fail(`Could not create the admin: ${error.message}`);
} finally {
  await mongoose.disconnect();
}
