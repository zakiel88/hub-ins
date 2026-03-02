# INS Commerce Hub

> Internal Commerce Operations Hub for INS / MBLVD — v1.1

## Features

### v1.1 — Operations Pipeline *(current)*

| Module | Description |
|--------|-------------|
| **Stores** | Connect Shopify stores via Client Credentials, auto-token rotation, connection health check |
| **Orders** | Full order pipeline: sync from Shopify, address validation (FedEx + Google), pipeline state management |
| **Merchandise** | Cross-order product line view — check stock, filter by state, link to procurement |
| **Procurement** | Purchase order management for items that need buying |
| **Inventory** | Warehouse operations (planned: QC workflow, damaged goods) |

### v1.0 — Foundation

- Auth (JWT + role-based), Dashboard, Brands, Catalog, Pricing
- Shopify product sync + price publishing
- User management, Audit log

## Order Pipeline States

```
NEW_FROM_SHOPIFY → CHECKING_ADDRESS → MER_CHECK → WAITING_PURCHASE → READY_TO_FULFILL → FULFILLED
                                                                   ↘ ON_HOLD
                                                                   ↘ CANCELLED
```

- **FedEx + Google** dual address validation
- **Auto-transition**: `fulfilled` → FULFILLED, `refunded/cancelled` → CANCELLED
- **Webhook-ready**: `POST /api/v1/webhooks/shopify` with HMAC verification

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19 |
| Backend | NestJS 10, Prisma ORM |
| Database | PostgreSQL (Supabase) |
| Cache | Redis (Upstash) |
| Auth | JWT + bcrypt |
| Deploy | Railway (API) + Vercel (Web) |

## Quick Start

```bash
# 1. Install
git clone <repo-url> && cd ins-commerce-hub
cp apps/api/.env.example apps/api/.env
npm install

# 2. Database
cd apps/api
npx prisma migrate dev
npx prisma db seed

# 3. Run
npm run dev   # API → :3001, Web → :3000
```

## Project Structure

```
apps/
├── api/                  NestJS backend (port 3001)
│   ├── src/
│   │   ├── auth/         JWT auth + role guards
│   │   ├── config/       Env validation, pipeline mapping
│   │   ├── order-pipeline/
│   │   │   ├── order-pipeline.controller.ts
│   │   │   ├── order-pipeline.service.ts
│   │   │   ├── order-sync.service.ts
│   │   │   └── webhook.controller.ts
│   │   ├── orders/       Order CRUD
│   │   ├── shopify-stores/ Store management
│   │   ├── procurement/  PO management
│   │   └── tasks/        Task system
│   └── prisma/           Schema + migrations
├── web/                  Next.js frontend (port 3000)
│   └── src/app/
│       ├── orders/       Order list + detail
│       ├── merchandise/  Cross-order product view
│       ├── stores/       Store connections
│       ├── procurement/  Purchase orders
│       └── tasks/        Task board
└── packages/shared/      Shared types
```

## API Endpoints

### Orders & Pipeline
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/orders` | List orders with filters |
| GET | `/api/v1/orders/:id` | Order detail |
| POST | `/api/v1/orders/:id/validate-address` | FedEx + Google address check |
| POST | `/api/v1/orders/:id/transition` | Pipeline state transition |
| GET | `/api/v1/merchandise` | All line items across orders |
| POST | `/api/v1/shopify-stores/:id/sync-orders` | Sync from Shopify |
| POST | `/api/v1/webhooks/shopify` | Shopify webhook receiver |

### Stores
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/shopify-stores` | Connect store |
| GET | `/api/v1/shopify-stores` | List stores |
| GET | `/api/v1/shopify-stores/:id/test-connection` | Test Shopify connection |

## Environment Variables

```bash
# Database (Supabase)
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# Redis (Upstash)
REDIS_HOST=xxx.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=xxx

# Security
JWT_SECRET=<64-char-hex>
ENCRYPTION_KEY=<64-char-hex>

# FedEx Address Validation
FEDEX_CLIENT_ID=xxx
FEDEX_CLIENT_SECRET=xxx

# Google Geocoding (fallback)
GOOGLE_MAPS_API_KEY=xxx

# Shopify (global defaults)
SHOPIFY_API_VERSION=2025-01
```

## Webhook Setup

```bash
# Register Shopify webhooks (requires public URL)
node setup-webhooks.js https://your-api-domain.com/api/v1/webhooks/shopify
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start API + Web dev servers |
| `npm run build` | Build for production |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed baseline data |
| `npm run db:studio` | Open Prisma Studio |

## License

Private — INS / MBLVD © 2026