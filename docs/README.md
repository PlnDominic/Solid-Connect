# Solid Connect - Concept & Architecture Docs

This folder distills `assets/Solid_Connect_Project_Concept_and_System_Architecture.pdf`
("Product Concept, Business Model and System Architecture," Aug 2026,
prepared for Solid Connect Limited) into working reference docs. It's a
client discussion/planning document, not a spec already built - read it as
the target direction, not a description of the current codebase.

| File | Covers |
|---|---|
| [product-overview.md](./product-overview.md) | Vision, business model, revenue streams, target market & launch strategy, users/roles, core user journeys |
| [marketplace-mechanics.md](./marketplace-mechanics.md) | Request/matching model, GIS-based provider matching, trust & verification levels, payments, disputes & safety |
| [system-architecture.md](./system-architecture.md) | Recommended stack, system diagram, Supabase strategy, scaling plan, backend module structure, security, API surface, DevOps |
| [data-model.md](./data-model.md) | Conceptual entities (Appendix A) and architecture flow (Appendix B) from the source document |
| [roadmap-and-risks.md](./roadmap-and-risks.md) | MVP scope table, development roadmap, key risks & mitigations, legal/compliance notes, open decisions for the client |

## Current implementation vs. this target architecture

The document describes the **target** system for ~1M users. The Expo app in
this repo today is an earlier-stage prototype and differs in real ways:

| Area | Document's target | This repo today |
|---|---|---|
| Backend | NestJS + TypeScript API layer; mobile never talks to Supabase directly for business logic | Mobile app (`src/api/*`) calls Supabase directly with the anon key - no API layer yet |
| Auth | Phone/email registration + OTP | Supabase anonymous auth only ("Demo mode" - see `src/lib/auth.ts`) |
| Matching | PostGIS spatial queries, weighted ranking (skill/distance/availability/rating/etc., §8) | Not implemented - `useTopProviders`/`useAllProviders` just sort by `provider_rating` |
| Payments | Modular gateway integration, commission split, possible escrow (§10) | Not implemented - no payment flow exists yet |
| Web portals | Next.js business portal + admin portal (§13, §19) | Not started - mobile-only right now |
| Organizations/projects | Full B2B workforce-marketplace module (§6.3, §12) | Not modeled in the current schema |
| Verification levels | 5-stage (registered → identity → profession → experience → Solid Connect verified/certified, §9) | Schema has a single `provider_verified` boolean plus `provider_certified` |

None of this means the document is wrong for the prototype - it means the
prototype is an early MVP slice (customer + provider roles, categories,
requests, quotes, jobs, chat, reviews) of the fuller system the document
describes. Use these docs to keep future work pointed at the same target
rather than improvising a different direction; update the table above as
gaps close.
