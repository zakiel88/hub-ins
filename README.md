# INS Commerce Hub

> Internal Commerce Operations Hub for INS / MBLVD — **v1.2 Production MVP**
>
> Live: **hub.inecso.com** (Web) · **api.inecso.com** (API)

---

## 🏗️ Architecture

| Layer | Technology | Host |
|-------|-----------|------|
| Frontend | Next.js 15, React 19 | Vercel |
| Backend | NestJS 10, Prisma ORM | Railway |
| Database | PostgreSQL | Supabase |
| Cache | Redis | Upstash |
| Auth | JWT + bcrypt + RBAC | — |
| Shopify | Admin REST API (2025-01) | — |

## 📋 MVP Modules — Production

### 1. Authentication & Users

- JWT login with role-based access control (`admin`, `merchandising`, `sourcing`, `brand_partner`)
- Password reset via email (Nodemailer)
- User management page (`/settings/users`)
- Per-store access control (`UserStoreAccess`)
- Audit logging for all mutations

### 2. Dashboard

- Overview stats: total orders, products, brands, revenue
- Quick links to all modules
- Real-time sync job status

### 3. Brands

| Feature | Status |
|---------|--------|
| Brand CRUD | ✅ |
| Brand detail with contacts, contracts | ✅ |
| Financial info (bank, payment terms, discount tiers) | ✅ |
| Lark sync via `lark_record_id` | ✅ |
| Brand → Collection → Product hierarchy | ✅ |

### 4. Product Management (PIM Hub)

The central product information management system. Products are synced from Shopify and managed here as the source of truth.

| Feature | Status |
|---------|--------|
| Product list with search, filter, pagination | ✅ |
| Product detail (Overview, Variant Groups & SKUs, Images, Store Mappings, Issues) | ✅ |
| **Inline variant editing** — edit Price, Cost, Size, Color, Status per SKU row | ✅ |
| Per-row Save + bulk "Save All Changes" with unsaved change counter | ✅ |
| Live margin recalculation on price/cost change | ✅ |
| Variant Groups — auto-created during sync (by color/material) | ✅ |
| Add Variant Group manually | ✅ |
| Product validation rules engine (missing cost, margin checks, missing images) | ✅ |
| Product Issues page (`/products/issues`) | ✅ |
| SKUs page (`/products/skus`) — all variants across products | ✅ |
| Product import page (`/products/import`) | ✅ |
| Archive/unarchive products | ✅ |

### 5. Shopify Sync

| Feature | Status |
|---------|--------|
| Connect stores via Client Credentials (OAuth) | ✅ |
| Auto token refresh | ✅ |
| Connection health check | ✅ |
| Full product sync (products, variants, images) | ✅ |
| VariantGroup auto-creation during sync | ✅ |
| ShopifyProductMap / ShopifyVariantMap linking | ✅ |
| Sync job tracking with logs | ✅ |
| Order sync from Shopify | ✅ |
| Webhook receiver (`POST /api/v1/webhooks/shopify`) with HMAC verification | ✅ |

### 6. Orders & Pipeline

Full order lifecycle management from Shopify import to fulfillment.

```
NEW_FROM_SHOPIFY → CHECKING_ADDRESS → MER_CHECK → WAITING_PURCHASE → READY_TO_FULFILL → FULFILLED
                                                                    ↘ ON_HOLD
                                                                    ↘ CANCELLED
```

| Feature | Status |
|---------|--------|
| Order list with filters (status, financial, fulfillment, pipeline state, store) | ✅ |
| Order detail page with Summary, Items, Log tabs | ✅ |
| FedEx + Google dual address validation | ✅ |
| Pipeline state transitions with confirmation modal | ✅ |
| Auto-transition on Shopify webhook (fulfilled → FULFILLED) | ✅ |
| Stock checking per line item | ✅ |
| Bulk item actions (mark IN_STOCK / NEEDS_PURCHASE) | ✅ |
| Auto-create Procurement Requests on NEEDS_PURCHASE | ✅ |
| Order log timeline with change tracking | ✅ |
| Tracking number display for fulfilled orders | ✅ |

### 7. Merchandise

- Cross-order product line view — all `OrderLineItem`s across all orders
- Filter by `itemState`, brand, mapping status
- Link items to products/variants
- Link to Procurement for items needing purchase

### 8. Procurement

| Feature | Status |
|---------|--------|
| Procurement requests auto-created from order pipeline | ✅ |
| Purchase order management | ✅ |
| PO items with quantity, pricing | ✅ |
| Link PO → Brand, PO → Order | ✅ |

### 9. Inventory

- Warehouse management
- Inventory items tracking
- Reservation system for orders
- QC workflow (planned)

### 10. Metafields Library

| Feature | Status |
|---------|--------|
| Sync metafield definitions from Shopify stores | ✅ |
| Category-driven schema (Taxonomy-based) | ✅ |
| Metafield values with approval workflow | ✅ |
| Push validated data back to Shopify REST Admin API | ✅ |
| Approval Queue page (`/approval-queue`) | ✅ |

### 11. Pricing

- Price list management
- Price publishing to Shopify stores

### 12. Tasks

- Task board for order-related work items
- Task assignment, priority, due dates
- Task comments

---

## 🗄️ Database Schema (41 Models)

```
Core:           User, UserStoreAccess, AuditLog, PasswordResetToken
Brands:         Brand, Bank, Contract, BrandContact, Collection
Products:       Product, VariantGroup, ProductVariant, ProductImage,
                ProductIssue, ProductValidationState
Shopify Maps:   ShopifyProductMap, ShopifyVariantMap, ShopifyStore
Sync:           ProductSyncJob, ProductSyncLog, SyncJob, SyncJobLog, SyncLog
Orders:         Order, OrderLineItem, OrderLog, WebhookEvent
Pipeline:       Task, TaskComment, InventoryReservation,
                ProcurementRequest, PurchaseOrder, PurchaseOrderItem
Inventory:      InventoryItem, Warehouse
Import:         ImportBatch, ImportRow
Metafields:     MetafieldDefinition, MetafieldDefinitionOption,
                CatalogMetafieldSchema, MetafieldValue
```

## 🌐 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/login` | JWT login |
| POST | `/api/v1/auth/forgot-password` | Send reset email |
| POST | `/api/v1/auth/reset-password` | Reset password |

### Products (PIM)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/products` | List products (search, filter, paginate) |
| GET | `/api/v1/products/summary` | Product stats |
| GET | `/api/v1/products/:id` | Product detail with variants, groups, images |
| PUT | `/api/v1/products/:id` | Update product (title, description, etc.) |
| PUT | `/api/v1/products/:id/variants/:vid` | Update variant (price, cost, status) |
| PATCH | `/api/v1/products/:id/variants/bulk` | Bulk update variants |
| GET | `/api/v1/product-variants` | List all SKUs |
| GET | `/api/v1/variant-groups` | List all variant groups |
| POST | `/api/v1/variant-groups` | Create variant group |
| GET | `/api/v1/issues` | Product issues |

### Shopify Sync
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/shopify-sync/stores/:id/sync` | Trigger full product sync |
| GET | `/api/v1/sync-jobs` | List sync jobs |
| POST | `/api/v1/webhooks/shopify` | Shopify webhook receiver |

### Orders & Pipeline
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/orders` | List orders with filters |
| GET | `/api/v1/orders/:id` | Order detail with line items |
| GET | `/api/v1/orders/summary` | Order stats |
| PATCH | `/api/v1/orders/:id/status` | Update order status |
| POST | `/api/v1/orders/:id/validate-address` | FedEx + Google address check |
| POST | `/api/v1/orders/:id/transition` | Pipeline state transition |
| GET | `/api/v1/orders/:id/check-stock` | Check stock for all items |
| GET | `/api/v1/orders/:id/transitions` | Available transitions |
| GET | `/api/v1/orders/:id/logs` | Order change log |
| GET | `/api/v1/merchandise` | Cross-order line items |

### Stores
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/shopify-stores` | Connect store |
| GET | `/api/v1/shopify-stores` | List stores |
| GET | `/api/v1/shopify-stores/:id/test-connection` | Test connection |
| POST | `/api/v1/shopify-stores/:id/sync-orders` | Sync orders |

### Metafields
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/metafields/definitions` | List definitions |
| POST | `/api/v1/metafields/sync-definitions` | Sync from Shopify |
| POST | `/api/v1/metafields/values` | Submit value |
| POST | `/api/v1/metafields/values/:id/approve` | Approve value |
| POST | `/api/v1/metafields/push` | Push to Shopify |

---

## 🖥️ Frontend Pages (26)

```
/                        Dashboard
/login                   Login
/forgot-password         Forgot password
/reset-password          Reset password
/brands                  Brand list
/brands/[id]             Brand detail
/products                Product list
/products/[id]           Product detail (Overview, Variants, Images, Mappings, Issues)
/products/import         Product import
/products/issues         Validation issues
/products/new            Create product
/products/skus           All SKUs
/products/variant-groups Variant groups
/products/variants       All variants
/orders                  Order list
/orders/[id]             Order detail (pipeline, address check, items, log)
/merchandise             Cross-order line items
/stores                  Shopify store connections
/procurement             Purchase order management
/inventory               Warehouse & inventory
/pricing                 Price management
/metafields              Metafield library
/approval-queue          Approval queue
/jobs                    Background jobs
/tasks                   Task board
/settings/users          User management
```

## 🚀 Quick Start

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

## ⚙️ Environment Variables

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

# Shopify
SHOPIFY_API_VERSION=2025-01
```

## 📁 Project Structure

```
apps/
├── api/                     NestJS backend (port 3001)
│   ├── src/
│   │   ├── auth/            JWT auth + role guards + password reset
│   │   ├── brands/          Brand CRUD + contacts + contracts
│   │   ├── collections/     Collection management
│   │   ├── config/          Env validation, pipeline config
│   │   ├── health/          Health check endpoint
│   │   ├── inventory/       Warehouse, inventory items
│   │   ├── jobs/            Background job management
│   │   ├── mail/            Email service (Nodemailer)
│   │   ├── metafields/      Metafield definitions, values, sync
│   │   ├── order-pipeline/  Pipeline transitions, webhook, stock check
│   │   ├── orders/          Order CRUD + summary
│   │   ├── prisma/          Prisma service
│   │   ├── procurement/     PO management
│   │   ├── products-v2/     Product CRUD + validation rules engine
│   │   ├── shopify-stores/  Store connection + token management
│   │   ├── shopify-sync/    Full product sync from Shopify
│   │   ├── tasks/           Task system
│   │   ├── uploads/         File uploads
│   │   └── users/           User management
│   └── prisma/
│       └── schema.prisma    41 models
├── web/                     Next.js frontend (port 3000)
│   └── src/
│       ├── app/             26 pages (see above)
│       └── lib/
│           └── api.ts       API client with all endpoints
└── packages/shared/         Shared types
```

## 📜 Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start API + Web dev servers |
| `npm run build` | Build for production |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed baseline data |
| `npm run db:studio` | Open Prisma Studio |

## 🔄 Changelog

### v1.2 — Product Management & Quality *(current — Mar 2026)*

- **Inline variant editing** — edit Price, Cost, Size, Color, Status per SKU in product detail
- **Variant Groups auto-creation** during Shopify sync (by color + material)
- **Product validation rules engine** — missing cost, low margin, missing images
- **Product Issues page** with severity/status tracking
- **SKUs page** — all variants across all products
- **Order detail fix** — added missing `order_line_items` columns (`variant_id`, `brand_id`, `shopify_variant_id`, `mapping_status`, `item_state`)
- **Defensive schema migrations** — startup migration adds missing columns safely via `ADD COLUMN IF NOT EXISTS`

### v1.1 — Operations Pipeline *(Feb 2026)*

- Full order pipeline: sync → address validation → MER check → procurement → fulfill
- FedEx + Google dual address validation
- Webhook receiver with HMAC verification
- Merchandise cross-order view
- Procurement auto-creation from pipeline
- Inventory reservation system

### v1.0 — Foundation *(Jan 2026)*

- Auth (JWT + RBAC), Dashboard, Brands, Catalog
- Shopify store connections + product sync
- Price publishing, User management, Audit log

---

**Private — INS / MBLVD © 2026**