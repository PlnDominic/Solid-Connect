# Product Overview

Source: §1–6 of the concept document.

## Executive summary

Solid Connect is envisioned as a trusted digital marketplace connecting
individuals, businesses, agencies and organizations with skilled artisans,
former professionals and other service providers. Delivered via mobile apps
(Android/iOS) supported by web-based business and administration portals.

The platform should support the complete service lifecycle: **provider
discovery → service requests → intelligent matching → quotations →
communication → job confirmation → completion → payment → dispute handling
→ reviews.**

Target scale: ~1,000,000 registered users, while avoiding unnecessary
complexity at launch.

**Proposed positioning:** Solid Connect connects people and organizations
with trusted artisans and experienced professionals based on skill,
location, availability, experience and reputation.

## Product vision

Long-term: a trusted digital infrastructure for finding and engaging
skilled people. Can start as an artisan marketplace and progressively
expand:

| Direction | Description |
|---|---|
| Artisan marketplace | Connect customers with plumbers, electricians, carpenters, masons, welders, painters, cleaners, repair specialists and other skilled workers |
| Professional services marketplace | Connect customers/organizations with experienced professionals for consulting, advisory, mentoring, technical supervision, project work |
| Workforce marketplace | Help organizations source skilled people for projects, recurring work, short-term engagements |

## Business model

Two-sided service marketplace with a B2B segment. Demand side: individuals,
businesses, agencies, organizations. Supply side: artisans, skilled
workers, experienced professionals.

### Value proposition

| Stakeholder | Value |
|---|---|
| Individuals | Convenient and trusted access to service providers |
| Artisans | Digital visibility, service requests, professional identity and reputation building |
| Former professionals | A channel to monetize experience through consulting, mentoring and project work |
| Businesses and agencies | Structured provider sourcing, quotations, projects and workforce management |
| Solid Connect | A scalable marketplace with transaction, subscription and premium revenue opportunities |

### Revenue streams

| Stream | Concept |
|---|---|
| Transaction commission | Percentage of completed service transactions or contracts |
| Business subscriptions | Paid plans for organizations requiring advanced project/workforce features |
| Provider premium services | Optional visibility, promotion, analytics, premium tools |
| Verification services | Selected paid verification services where commercially/legally appropriate |
| Large project facilitation | Negotiated fees for large workforce or professional engagements |
| Recurring service contracts | Commission or service fees from recurring engagements |

### Marketplace flywheel

```
More providers -> more skills available -> more customers can find providers
  -> more jobs -> more provider earnings -> more providers join
  -> more reviews and marketplace data -> better matching -> more customers
```

## Target market and launch strategy

A **focused launch** is recommended over serving every category/location at
once.

| Stage | Focus |
|---|---|
| Initial launch | Greater Accra and selected high-demand service categories |
| Expansion | Kumasi, Tema, Takoradi, Cape Coast, Tamale and other high-demand areas |
| National scale | Broader Ghana coverage and expanded professional categories |
| Regional scale | Potential expansion into other African markets after the Ghana model is proven |

Potential initial categories: Plumbing, Electrical services, Carpentry,
Masonry, Painting, Welding, Cleaning, Air-conditioning and appliance
repair, Auto services.

> The current prototype's seed categories (`supabase/seed/seed.sql`) are a
> subset of this list - check alignment when adding/renaming categories.

## Users, actors and roles

Role-based access, but **one person can hold multiple roles** (e.g. a
professional can both request and offer services through the same
account). The current app already reflects this at a basic level: one
Supabase profile with a switchable `role` (`customer` | `provider`).

| Actor | Primary responsibilities |
|---|---|
| Individual customer | Find services, create requests, compare providers, communicate, hire, pay, review |
| Artisan / service provider | Create profile, define skills and service area, respond to requests, quote, perform jobs, receive payment |
| Experienced professional | Offer consulting, advisory, mentoring, technical and project-based services |
| Business / agency | Create organization account, manage team members, create projects and requests, source providers, manage engagements |
| Solid Connect administrator | Manage users, verification, categories, requests, jobs, disputes, payments, content, analytics |

## Core user journeys

### Customer

```
Open app -> Register / Sign in -> Select service -> Describe requirement
  -> Add location -> Select timing -> Add budget if applicable
  -> Upload photos or video if needed -> Submit request -> Providers matched
  -> Receive quotations -> Compare providers -> Select provider
  -> Chat and coordinate -> Job completed -> Payment / confirmation
  -> Review provider
```

### Provider

```
Register -> Create provider profile -> Select skills and categories
  -> Add experience and portfolio -> Submit verification -> Approval
  -> Set service area and availability -> Receive requests -> Quote
  -> Communicate -> Complete job -> Receive payment
  -> Build rating and work history
```

### Organization

```
Create organization -> Add members and roles -> Create project
  -> Create workforce/service request -> Receive applications / quotations
  -> Select providers -> Manage project -> Approve work
  -> Payment and reporting -> Maintain provider relationship
```

> Organizations/projects are not modeled in the current schema - see
> [../docs/README.md](./README.md#current-implementation-vs-this-target-architecture).
