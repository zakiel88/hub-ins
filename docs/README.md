# INS Commerce Hub

Internal Commerce Operations Hub for INS / MBLVD.

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url> && cd ins-commerce-hub
cp .env.example .env
npm install

# 2. Start infrastructure
npm run dev:infra    # Postgres + Redis via Docker

# 3. Database setup
npm run db:migrate   # Apply Prisma migrations
npm run db:seed      # Seed admin user + warehouse

# 4. Start dev servers
npm run dev          # API (3001) + Web (3000)
```

## Verify

| Check | Command / URL |
|-------|--------------|
| API liveness | `curl http://localhost:3001/api/v1/health` |
| API readiness | `curl http://localhost:3001/health/ready` |
| Web UI | Open `http://localhost:3000` |
| DB studio | `npm run db:studio` |

## Project Structure

```
├── apps/api/       NestJS backend (port 3001)
├── apps/web/       Next.js frontend (port 3000)
├── packages/shared/ Shared types, constants, utils
├── infra/scripts/   Dev/ops scripts
└── docs/            Documentation
```

## Architecture

See architecture documents in `.gemini/antigravity/brain/`:
- `implementation_plan.md` — MVP 1.0 architecture (v1.0)
- `architecture_revision_v1.1.md` — Hardening revision
- `architecture_patch_v1.1.1.md` — Mini patch

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start everything (infra + API + Web) |
| `npm run dev:infra` | Docker Compose up |
| `npm run dev:api` | API only |
| `npm run dev:web` | Web only |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed baseline data |
| `npm run db:reset` | Reset DB + re-migrate + re-seed |
| `npm run db:studio` | Open Prisma Studio |
