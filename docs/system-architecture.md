# System Architecture

Source: §12–18, §23–24 of the concept document.

## Core product features (module map)

| Module | Core features |
|---|---|
| Authentication | Phone/email registration, OTP, login, sessions, recovery |
| Profiles | Customer, provider and organization profiles |
| Provider marketplace | Skills, categories, experience, portfolio, service areas, availability, reviews, verification |
| Service requests | Description, location, timing, budget, media attachments |
| Matching | Location and skill matching with ranking |
| Quotes | Provider quotation, comparison and acceptance |
| Jobs | Job lifecycle and completion confirmation |
| Chat | Customer–provider and organization–provider communication |
| Payments | Payment status, commissions, payouts, refunds |
| Reviews | Post-job ratings and reviews |
| Notifications | Push and in-app notifications |
| Organizations | Business profiles, members, projects, workforce requests |
| Administration | Users, verification, disputes, payments, categories, reports, analytics |

## System architecture diagram

```
                     SOLID CONNECT
                          |
         +----------------+----------------+
         |                |                |
    React Native       Next.js          Admin Web
    iOS / Android      Business          Portal
         |                |                |
         +----------------+----------------+
                          |
                     HTTPS / TLS
                          |
                   CDN / WAF / LB
                          |
                          v
                +---------------------+
                |    NestJS API       |
                |     TypeScript      |
                +----------+----------+
                           |
      +--------------------+--------------------+
      |                    |                    |
   Core Logic          Matching             Payments
      |                    |                    |
      +--------------------+--------------------+
                           |
                     SUPABASE PLATFORM
                           |
      +--------------------+--------------------+
      |                    |                    |
  PostgreSQL             Storage             Realtime
   + PostGIS
                           |
                         Redis
                   Cache / Queues
                           |
                External Services
           Maps / Payment / SMS / Push
```

## Recommended technology stack

| Layer | Technology | Purpose |
|---|---|---|
| Mobile | React Native + TypeScript + Expo | Cross-platform iOS and Android app |
| Navigation | React Navigation | Screen navigation and role-based flows |
| Mobile state | Zustand | Lightweight local state |
| Server state | TanStack Query | Caching, fetching and synchronization |
| Business web | Next.js + React + TypeScript | Business and agency portal |
| Admin web | Next.js + React + TypeScript | Administration and operations |
| Backend | NestJS + Node.js + TypeScript | Core business logic and REST API |
| Database | Supabase PostgreSQL | Transactional application data |
| GIS | PostGIS | Location and spatial queries |
| Authentication | Supabase Auth | Identity and sessions |
| Storage | Supabase Storage | Images, documents, portfolio media |
| Realtime | Supabase Realtime | Chat and selected live updates |
| Cache / queue | Redis + BullMQ | Caching, rate limiting, background jobs |
| Search | PostgreSQL initially, OpenSearch later | Provider and service search |
| Maps | Google Maps or Mapbox | Maps, geocoding, location |
| Notifications | FCM + APNs | Android and iOS push |
| Infrastructure | Supabase + AWS/Cloudflare as required | Scalable cloud infrastructure |
| CI/CD | GitHub Actions | Automated testing and deployment |
| Monitoring | Sentry + OpenTelemetry | Application observability |

> **Where this repo stands today:** Mobile (Expo/RN + TypeScript), React
> Navigation, Zustand, TanStack Query, and Supabase (Postgres/Auth) match
> the target exactly. Not yet present: NestJS API layer, Next.js portals,
> PostGIS, Storage/Realtime usage, Redis/BullMQ, search, maps, push,
> Sentry/OpenTelemetry, CI/CD. The mobile app currently calls Supabase
> directly (`src/lib/supabase.ts`) rather than through a backend API - see
> the key architecture principle below.

## Supabase strategy

Supabase is recommended as a **managed platform foundation**, not the
location for all application logic.

| Capability | Recommended use |
|---|---|
| PostgreSQL | Core transactional data |
| PostGIS | Geographic matching and spatial analysis |
| Auth | Authentication and sessions |
| Storage | Profile photos, portfolios, documents |
| Realtime | Chat and selected live updates |
| Edge Functions | Lightweight server-side functions where appropriate |

**Key architecture principle:** the mobile app should **not** contain
critical marketplace business rules. React Native should talk to the
NestJS backend; NestJS manages business logic and accesses Supabase
securely.

> This is the single biggest structural gap between the document and the
> current prototype: today, `src/api/*` calls Supabase directly from the
> client with the anon key and relies on RLS policies
> (`supabase/migrations/0001_init.sql`) for access control - there is no
> NestJS layer. That's a reasonable simplification for a prototype/demo,
> but real business logic (matching, commission math, payout rules,
> verification workflows) should move behind an API before this scales.

## Architecture for ~1,000,000 users

Treat 1M users as a capacity objective, not a mandate to deploy
microservices from day one - scale horizontally as traffic actually grows.

```
Internet
   |
CDN / WAF
   |
Load Balancer
   |
 +-- API 1
 +-- API 2
 +-- API N
   |
Core Services
   |
 +-- PostgreSQL + PostGIS
 +-- Redis
 +-- Search
   |
Read replicas / backups as required
```

- Horizontal API scaling
- Connection pooling and efficient indexing
- Read replicas when database reads require them
- Background queues for notifications and non-critical work
- Redis caching and rate limiting
- Object storage and CDN for media
- OpenSearch when search volume/complexity justifies it
- Monitoring and optimization based on real usage

| Scale stage | Architecture direction |
|---|---|
| 0–100,000 users | Supabase foundation, NestJS modular backend, React Native, basic Redis, CDN, monitoring |
| 100,000–1,000,000 users | Multiple API instances, workers, stronger caching, database read capacity, search, enhanced monitoring |
| 1–10 million users | Evaluate specialized services, event streaming, dedicated search, data warehouse, Kubernetes or multi-region deployment based on actual demand |

## Backend and microservices strategy

A **modular monolith** is recommended initially - NestJS separated into
clear modules while keeping deployment/development manageable:

```
solid-connect-api
 +-- auth
 +-- users
 +-- roles
 +-- providers
 +-- services
 +-- categories
 +-- requests
 +-- matching
 +-- quotes
 +-- jobs
 +-- contracts
 +-- payments
 +-- reviews
 +-- verification
 +-- organizations
 +-- projects
 +-- chat
 +-- notifications
 +-- disputes
 +-- admin
```

Individual modules can later be extracted into independent services if a
component (search, chat, notifications, matching, payments) develops an
independent scaling requirement.

## Security architecture

- TLS for data in transit
- Secure authentication and token management
- Role-based access control
- Multi-factor authentication for sensitive administrative accounts
- API rate limiting and abuse protection
- Input validation and secure file uploads
- Encrypted storage and secure handling of sensitive documents
- Audit logs for administrative, payment and verification events
- Dependency and vulnerability scanning
- Automated backups and tested recovery procedures

## API and integration architecture

Versioned REST endpoints with strong validation, authentication,
authorization and OpenAPI documentation:

```
/api/v1/auth
/api/v1/users
/api/v1/providers
/api/v1/services
/api/v1/categories
/api/v1/requests
/api/v1/quotes
/api/v1/jobs
/api/v1/payments
/api/v1/reviews
/api/v1/chat
/api/v1/notifications
/api/v1/organizations
/api/v1/projects
/api/v1/admin
```

## DevOps, deployment and reliability

```
Developer -> GitHub -> Pull Request
  -> Automated tests and security checks -> Build -> Staging
  -> Approval -> Production
```

- GitHub Actions for CI/CD
- Docker for reproducible builds
- Separate development, staging and production environments
- Terraform for cloud infrastructure where appropriate
- Automated database backups and recovery testing
- Application monitoring, logs and error tracking from the beginning
