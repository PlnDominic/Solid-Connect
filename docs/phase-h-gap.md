# Phase H — Gap

Date: 2026-09-28  
Scope: Reviews, ratings, complaints, evidence, dispute administration

## Before

- Customers could insert a review or dispute straight from the app.
- Disputes had a reason and a description, but no photos filed with the complaint.
- Admin could resolve a dispute and attach a refund, using request photos only.

## After

- Nest owns review and dispute creation: completed job, one review, 1–5 stars, 48-hour dispute window.
- Both sides can attach up to five photos each. They are stored in the private `dispute-evidence` bucket, recorded in `dispute_evidence`, and show on the admin dispute page through signed links.
- The provider is notified when a dispute is opened.
