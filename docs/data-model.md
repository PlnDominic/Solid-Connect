# Conceptual Data Model

Source: Appendix A & B of the concept document.

## Appendix A: Conceptual data entities

| Entity | Purpose |
|---|---|
| User | Core identity record |
| Role | Customer, provider, professional, organization and administrator capabilities |
| Profile | Public or private user information |
| Provider Profile | Skills, experience, service areas, availability and reputation |
| Skill | Specific capability offered by a provider |
| Service Category | Grouping of services |
| Service Request | Customer or organization request |
| Quote | Provider response to a request |
| Job | Accepted service engagement |
| Contract | Longer-term or formal engagement |
| Organization | Business or agency account |
| Project | Organization-level work grouping |
| Payment | Payment and payout record |
| Review | Customer or organization feedback |
| Message | Chat communication |
| Notification | System notification |
| Verification | Identity, qualification or experience verification |
| Document | Uploaded verification or project document |
| Dispute | Formal marketplace complaint |

### Mapping to the current schema

`supabase/migrations/0001_init.sql` / `src/types/database.ts` implement a
subset of the above:

| Document entity | Current schema equivalent | Notes |
|---|---|---|
| User / Role / Profile | `Profile` (`role: 'customer' \| 'provider'`) | Single profile row carries both identity and role; no separate `User`/`Role` tables |
| Provider Profile / Skill | Fields on `Profile` (`provider_category`, `provider_rating`, `provider_jobs_count`, `provider_distance_km`, `provider_verified`, `provider_certified`) | No separate skills table - one category per provider, not a skill list |
| Service Category | `Category` | Present |
| Service Request | `ServiceRequest` | Present |
| Quote | `Quote` | Present |
| Job | `Job` | Present |
| Contract | - | Not modeled |
| Organization / Project | - | Not modeled |
| Payment | `Payment` | Type exists; no gateway integration |
| Review | (referenced via `useSubmitReview` in `src/api/jobs.ts`) | Present at the API level |
| Message | Chat tables (see `src/api/chat.ts`) | Present |
| Notification | - | Not modeled yet (screen exists: `NotificationsScreen.tsx`, likely placeholder) |
| Verification / Document | `provider_verified` / `provider_certified` booleans | No verification workflow or document upload yet |
| Dispute | - | Not modeled |

## Appendix B: Conceptual architecture flow

```
CUSTOMER / PROVIDER / ORGANIZATION
                |
                v
       React Native / Next.js
                |
                v
       HTTPS / Authentication
                |
                v
          NestJS REST API
                |
     +----------+----------+
     |          |          |
     v          v          v
 Marketplace Matching   Payments
     |          |          |
     +----------+----------+
                |
                v
       Supabase PostgreSQL
             + PostGIS
                |
       +--------+--------+
       |        |        |
      Auth   Storage   Realtime
                |
              Redis
        Cache + Background Jobs
                |
       External Maps / Payments
                |
       Push / SMS / Email
```
