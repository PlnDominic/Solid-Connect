# Phase A — Foundation Acceptance Report

Date: 2026-09-09  
Scope: Master-spec Phase A (repository structure, NestJS, env, Redis wiring, RBAC scaffolding, logging, errors, CI)

## Gap report (pre-phase)

Published as canvas: `solid-connect-gap-report.canvas.tsx`  
Summary: Expo mobile + Next admin exist; NestJS/Redis/CI were missing; marketplace rules still live in the mobile client.

## What was implemented

| Deliverable | Location | Status |
|---|---|---|
| NestJS API scaffold | `api/` | Done |
| Shared types package (minimal) | `packages/shared-types` | Done |
| Redis compose service | `docker-compose.yml` | Done |
| Config + `.env.example` | `api/src/config`, `api/.env.example` | Done |
| Health endpoint | `GET /api/v1/health` | Done |
| Supabase JWT guard (JWKS) | `api/src/auth/guards/supabase-jwt.guard.ts` | Done |
| Roles guard + suspended check | `api/src/auth/guards/roles.guard.ts` | Done |
| `GET /api/v1/auth/me` | `api/src/auth/auth.controller.ts` | Done |
| Global exception envelope | `api/src/common/filters/api-exception.filter.ts` | Done |
| Request-ID logging interceptor | `api/src/common/interceptors/logging.interceptor.ts` | Done |
| Rate limiting (Throttler) | `AppModule` | Done |
| OpenAPI | `/docs` | Done |
| Unit tests (RolesGuard) | `roles.guard.spec.ts` | Done |
| E2E health | `api/test/app.e2e-spec.ts` | Done |
| GitHub Actions CI | `.github/workflows/ci.yml` | Done |

## Exit criteria

| Criterion | Result | Notes |
|---|---|---|
| API deploys / boots | **PASS (local)** | `npm run build` + `npm run start:dev` in `api/` |
| Unit tests | **PASS** | 4/4 RolesGuard tests |
| TypeScript build | **PASS** | `nest build` clean |
| Database migrations work | **BLOCKED** | Still need `DATABASE_URL` or SQL Editor for pending 0007/0008/0010 |
| Auth connectivity works | **PARTIAL** | JWKS verification wired; roles still default to `CUSTOMER` until Phase B DB |
| Staging environment exists | **PARTIAL** | Compose + env templates only; no cloud staging deploy yet |
| Redis available | **DEGRADED OK** | Health returns `degraded` if Redis down; Docker Desktop required for `up` |

## Intentionally not done in Phase A

- Moving mobile into `apps/mobile` (adapt-in-place; avoid breaking Expo root)
- BullMQ workers (wired Redis first; queues in later phases)
- Migrating accept-quote / job-complete off the mobile client (Phase E/F)
- PostGIS, OTP, organizations

## How to run

```bash
# optional Redis
docker compose up -d redis

cd api
cp .env.example .env   # or use generated api/.env
npm install
npm run start:dev
# Health: http://localhost:3001/api/v1/health
# Docs:   http://localhost:3001/docs
```

## Next phase

**Phase B — Identity and marketplace foundation**: `users` / `roles` / `user_roles` migrations, NestJS register/login/me with real role resolution, keep Expo auth UX calling API where practical without deleting working screens.
