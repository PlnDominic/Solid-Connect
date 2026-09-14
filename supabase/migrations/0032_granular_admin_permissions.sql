-- Solid Connect - item 15 from the "20 more things" list: granular admin
-- permissions. Today's model is binary - owner vs support, where support
-- means "everything an admin can do except manage the team, read the
-- audit log, or change the commission rate." This adds a permission set
-- a support admin can be individually scoped down from, e.g. an admin
-- who moderates reviews but shouldn't touch payouts.

alter table public.admins
  add column if not exists permissions text[] not null default '{}';

comment on column public.admins.permissions is
  'Support-admin feature scopes: verifications, disputes, payments, payouts, '
  'categories, reviews, accounts, broadcast. Ignored for role=owner, who always '
  'has every scope plus the owner-only governance actions (team, audit log, '
  'commission rate) that are never delegable through this column.';

-- Preserve current behavior for admins who already exist: every active
-- support admin today can already do everything support access covers.
-- Backfill full permissions so nobody's access silently narrows the
-- moment this ships - an owner can deliberately restrict someone
-- afterward from the Team page.
update public.admins
set permissions = array['verifications','disputes','payments','payouts','categories','reviews','accounts','broadcast']
where role = 'support' and permissions = '{}';
