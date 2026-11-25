import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';

import { errorHandler, notFound } from './middleware/errorHandler.js';
import discountRoutes from './routes/discountRoutes.js';
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import wishlistRoutes from './routes/wishlistRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import { mountGraphQL } from './graphql/index.js';

/**
 * Builds the Express app without connecting to MongoDB or listening on a port, so tests can
 * drive it in-process with supertest (see tests/).
 */
export async function createApp() {
  const app = express();

  // Behind Docker/nginx/a PaaS router the client IP comes from X-Forwarded-For (rate limiting needs it).
  app.set('trust proxy', 1);

  // Security headers. Uploaded images are served to the client on another origin, hence CORP.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // The JSON API has no HTML to protect; CSP stays on in production but is relaxed in
      // development so the Apollo Sandbox at /graphql can load.
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    }),
  );
  app.use(
    cors({
      origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((o) => o.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Uploaded images (multer writes them to server/uploads relative to the working directory).
  const uploadPath = path.resolve('server/uploads');
  fs.mkdirSync(uploadPath, { recursive: true });
  app.use('/uploads', express.static(uploadPath));

  app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString(), uptime: process.uptime() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/wishlist', wishlistRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/staff', staffRoutes);
  app.use('/api/discounts', discountRoutes);
  app.use('/api/contact', contactRoutes);

  // Read-only GraphQL API for the catalogue and a customer's own orders (see graphql/).
  await mountGraphQL(app);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
