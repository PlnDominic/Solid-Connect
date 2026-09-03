# Roadmap, Risks & Open Decisions

Source: §19–22, §25–28 of the concept document.

## Administration and operations (target scope)

| Area | Capabilities |
|---|---|
| Dashboard | Users, providers, organizations, active jobs, revenue, verification, disputes |
| Users | Search, view, edit, suspend, manage accounts |
| Providers | Verification, skills, portfolios, service areas, performance |
| Requests and jobs | Monitor lifecycle, investigate issues |
| Payments | Transactions, commissions, payouts, refunds, exceptions |
| Verification | Review and approve or reject documents |
| Disputes | Review complaints, evidence, outcomes |
| Content | Categories, service types, platform settings |
| Analytics | Marketplace, demand, supply, geographic trends |

## Analytics and marketplace intelligence (target KPIs)

| KPI | Purpose |
|---|---|
| Requests created | Measures demand |
| Requests fulfilled | Measures marketplace effectiveness |
| Provider response rate | Measures supply engagement |
| Time to first response | Measures responsiveness |
| Time to hire | Measures efficiency |
| Job completion rate | Measures reliability |
| Cancellation rate | Measures operational health |
| Average transaction value | Supports pricing and revenue analysis |
| Platform commission | Measures monetization |
| Customer retention | Measures repeat usage |
| Provider retention | Measures supply health |

## Future AI opportunities (post-validation)

- Natural-language service classification
- Intelligent provider matching
- Price estimation
- Fraud and abuse detection
- Customer support assistant
- Demand and provider-supply forecasting

> AI should be introduced **after** the core marketplace is validated and
> sufficient quality data is available - not before.

## Recommended MVP scope

| Feature | MVP | Phase 2 | Phase 3 |
|---|:---:|:---:|:---:|
| Registration and authentication | ✅ | | |
| Customer profiles | ✅ | | |
| Provider profiles | ✅ | | |
| Provider verification | ✅ | | |
| Service categories | ✅ | | |
| Service requests | ✅ | | |
| Location and GIS matching | ✅ | | |
| Quotes | ✅ | | |
| Chat | ✅ | | |
| Jobs and completion | ✅ | | |
| Reviews | ✅ | | |
| Payments | ✅ (subject to final design) | | |
| Business / agency accounts | | ✅ | |
| Projects and workforce requests | | ✅ | |
| Recurring services | | ✅ | |
| Advanced analytics | | ✅ | |
| OpenSearch | | As required | |
| AI matching | | | ✅ |
| Predictive pricing | | | ✅ |
| Advanced workforce optimization | | | ✅ |

> **Where the prototype stands against MVP scope:** registration/auth
> (demo/anonymous only), customer & provider profiles, service categories,
> service requests, quotes, chat, jobs & completion, and reviews are
> present in some form. Provider verification is a boolean flag rather
> than a workflow. Location/GIS matching and real payments are **not**
> implemented - see [system-architecture.md](./system-architecture.md) and
> [marketplace-mechanics.md](./marketplace-mechanics.md) for the gaps.

## Proposed development roadmap

| Stage | Focus |
|---|---|
| 1 | Requirements validation, business rules, actors and user journeys |
| 2 | UI/UX design, information architecture and prototype |
| 3 | Database ERD, API specification and technical foundation |
| 4 | Authentication, profiles, categories and provider onboarding |
| 5 | Requests, matching, quotations, jobs and chat |
| 6 | Payments, reviews, verification and notifications |
| 7 | Business portal and administration portal |
| 8 | Testing, security review, performance testing and production preparation |
| 9 | App Store and Google Play deployment |
| 10 | Post-launch monitoring, optimization and feature expansion |

## Key product and technical risks

| Risk | Mitigation |
|---|---|
| Low marketplace liquidity | Launch in a focused geography and limited number of high-demand categories |
| Unverified providers | Use staged identity, qualification and experience verification |
| Poor service quality | Use completed-job reviews, performance history and dispute management |
| Off-platform transactions | Provide useful in-app communication, payment and job management |
| Payment disputes | Define clear payment, completion and refund rules |
| Database bottlenecks | Use indexing, pooling, caching, read capacity and background processing |
| Media growth | Use object storage and CDN |
| Over-engineering | Start modular and scale components based on actual usage |
| Security threats | Use WAF, RBAC, MFA for admins, rate limiting, audit logs and security testing |

## Legal, compliance and governance

> Confirm exact legal/regulatory requirements with qualified legal and
> compliance professionals before launch.

- Terms of service and user agreements
- Privacy policy and data protection requirements
- Provider terms and service arrangements
- Organization and project contracting arrangements
- Payment, refund and dispute policies
- Identity and professional verification policies
- Data retention and deletion procedures
- Professional licensing requirements for regulated services
- Consumer protection and marketplace responsibilities

## Recommended next steps with Solid Connect Limited

Decisions to finalize before/alongside further development:

1. Confirm the primary launch market and initial service categories.
2. Confirm the exact user types and whether users can have multiple roles.
3. Confirm whether the initial product is an artisan marketplace,
   professional services marketplace, workforce marketplace, or phased
   combination.
4. Confirm provider verification and who performs verification.
5. Confirm payment processing, commission rules and whether escrow is
   required.
6. Confirm the organization and agency workflow.
7. Confirm MVP features and launch priorities.
8. Confirm branding, domain, app ownership and Apple App Store / Google
   Play accounts.
9. Confirm data ownership, hosting preferences and operational
   responsibilities.
10. Confirm legal, privacy and compliance requirements.
11. Approve the technical architecture and proceed to detailed
    requirements and database design.

## Recommended architecture summary

> React Native + Expo for mobile, Next.js for business and admin web,
> NestJS + TypeScript for the core backend, Supabase PostgreSQL + PostGIS
> for the data foundation, Supabase Auth/Storage/Realtime for selected
> managed services, Redis for caching and background jobs, and
> AWS/Cloudflare infrastructure as scale and operational requirements
> increase.

This approach balances development speed, maintainability, geographic
capability, security and future scalability - avoiding unnecessary
microservices complexity at launch while preserving a clear path to
specialized services and larger infrastructure as Solid Connect grows.
