# ReTechExchange: E-Waste Drop-off and Refurbished Electronics Marketplace

[![CI](https://github.com/naweedhah/E-Waste-Management/actions/workflows/ci.yml/badge.svg)](https://github.com/naweedhah/E-Waste-Management/actions/workflows/ci.yml)

ReTechExchange keeps electronics in use for longer. Customers book a drop-off for their old devices at
a branch, technicians refurbish what can be reused, and the refurbished devices are sold in an
online marketplace. Admin and staff dashboards cover inventory, orders, appointments, discounts and
reports.

**Stack:** React 18 · Vite · Tailwind CSS · Node.js · Express · MongoDB/Mongoose · JWT · Zod ·
GraphQL (Apollo Server + DataLoader) · Vitest + Supertest + mongodb-memory-server · Docker · GitHub Actions

## Features

**Customers:** register with email OTP verification, browse and search the marketplace, wishlist,
cart, checkout with live discounts, order history with PDF invoices, book and manage drop-off
appointments.

**Staff:** branch dashboard, appointment handling, stock adjustments, order processing.

**Admins:** users and staff, products and inventory, discounts (per product, per category, store-wide),
sales and revenue charts, PDF summary reports.

## Engineering highlights

| Problem | Solution |
| --- | --- |
| Two customers buying the last unit at the same moment | Stock is reserved with one atomic conditional update (`{ stockQuantity: { $gte: qty } }` + `$inc`). A multi-item order reserves every line or none, with compensating updates on failure. A test fires 4 concurrent checkouts at 1 unit and asserts exactly one succeeds ([`services/inventory.js`](server/services/inventory.js)) |
| Two customers booking the same drop-off slot | A partial unique index on branch + date + time slot (cancelled bookings excluded) makes double-booking impossible at the database level; the losing request gets 409 |
| Unvalidated input reaching controllers | Every route validates `params`, `query` and `body` with Zod schemas ([`validation/schemas.js`](server/validation/schemas.js)): ObjectIds, Sri Lankan phone and postal formats, booking window, time slots, password strength, price ranges. Errors come back per field |
| Prices from the client | Order totals are recalculated from the database and the active discounts at checkout |
| Verification and reset codes stored in plain text | Codes come from `crypto.randomInt`, are stored as HMAC-SHA256 hashes and compared in constant time; brute force is rate-limited (5 tries / 15 min) |
| Account enumeration and password guessing | "Forgot password" gives the same answer for unknown emails; login is rate-limited per IP + email; Helmet sets security headers; secrets and passwords are redacted from logs |
| Staff could only see listed products | The catalogue honours `status=all` and large pages only for authenticated staff/admins; shoppers are always limited to listed products |
| N+1 queries in nested GraphQL | Per-request DataLoaders batch product and discount lookups. A test asserts that 3 orders × 3 items cost one products query. A depth limit rejects abusive queries |

## GraphQL API

REST handles writes (checkout, bookings, admin). A read-only GraphQL endpoint at `/graphql` serves the
storefront and "my orders", where each screen needs a different slice of the same data.

```graphql
query Storefront {
  products(filter: { category: laptops, maxPrice: 150000 }, sort: PRICE_ASC, pageSize: 6) {
    total
    hasNextPage
    items { id name price finalPrice discount { name endsAt } inStock }
  }
  categories { category count minPrice maxPrice }
  me {                     # send the same Bearer token as the REST API
    orders(limit: 5) {
      orderNumber orderStatus totalAmount
      items { quantity lineTotal product { name images } }
    }
  }
}
```

In development, open http://localhost:3000/graphql for Apollo Sandbox with schema docs.

## Run it

### Docker (one command)

```bash
docker compose up --build
```

| Service | URL |
| --- | --- |
| Web app | http://localhost:5173 |
| REST API | http://localhost:3000/api |
| GraphQL | http://localhost:3000/graphql |
| MongoDB | mongodb://localhost:27017/retechex |

Demo data is seeded on first start. The demo accounts `admin@retechex.local`, `staff@retechex.local`
and `customer@retechex.local` use the password `Demo12345`. Without SMTP settings, emails are rendered but not sent.

### Local

Requirements: Node.js 20+ and MongoDB (local or Atlas).

```bash
# API
cd server
cp .env.example .env        # set MONGODB_URI and JWT_SECRET
npm install
npm run seed                # demo data (optional)
npm run dev                 # http://localhost:3000

# Web app (second terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

Create a real admin account with `ADMIN_EMAIL` and `ADMIN_PASSWORD` set, then run `npm run create-admin`.

### Tests

```bash
cd server
npm test                    # 35 API tests against an in-memory MongoDB (no setup needed)
```

The suite covers concurrent checkout and booking races, all-or-nothing stock reservation, discount
pricing, validation errors, OTP hashing and single-use reset codes, access control, and the GraphQL
API, including the N+1 check.

## Project structure

```text
client/                     React + Vite single-page app
  src/pages/                customer, admin/ and staff/ screens
  src/services/api.js       Axios API layer
server/
  app.js                    Express app (no listen, so tests can import it)
  server.js                 connects MongoDB and starts listening
  routes/                   REST routes; validation and auth middleware applied per route
  validation/schemas.js     Zod request schemas
  controllers/              request handlers
  services/inventory.js     atomic stock reservation and adjustment
  graphql/                  schema, resolvers, DataLoaders, depth limit
  middleware/               auth, roles, validation, rate limits, uploads, errors
  models/                   Mongoose models and indexes
  utils/                    email, PDF generation, OTP helpers, seed script
  tests/                    Vitest + Supertest + mongodb-memory-server
docker-compose.yml          MongoDB + seed + API + web app
```
