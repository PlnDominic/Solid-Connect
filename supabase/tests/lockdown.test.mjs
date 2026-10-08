// Tests for the access rules in migrations 0078-0080 (profile writes,
// marketplace writes, marketplace reads).
//
// Runs the REAL migration files against PGlite (Postgres compiled to
// WebAssembly - no database or Docker needed) on top of a reduced copy of the
// schema: the same table and column names and the old, wide-open policies
// from 0001, plus stand-ins for the SECURITY DEFINER functions and triggers
// that do the real work. Each test acts as a particular signed-in user (or
// signed out) and checks what they can and cannot do.
//
//   npm run test:rls
//
// This is NOT a replacement for running the migrations on a staging copy of
// the live database - it checks the access rules, not the full schema.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
const migration = (name) => readFileSync(join(here, '..', 'migrations', name), 'utf8');

const ID = {
  alice: '00000000-0000-0000-0000-00000000a001', // customer, has R1 and the org request R3
  bob: '00000000-0000-0000-0000-00000000b002', // another customer, has R2
  oscar: '00000000-0000-0000-0000-00000000c003', // member of alice's organization
  pat: '00000000-0000-0000-0000-00000000d004', // provider matched to R1 and saved by alice
  quinn: '00000000-0000-0000-0000-00000000e005', // provider with no link to R1
  rex: '00000000-0000-0000-0000-00000000f006', // provider who quoted on R1 and has job J1
  dana: '00000000-0000-0000-0000-00000000a007', // provider R4 was sent to directly
  zed: '00000000-0000-0000-0000-00000000a009', // provider with no link to any request
  ada: '00000000-0000-0000-0000-00000000a008', // admin
  org: '00000000-0000-0000-0000-0000000000f1',
  r1: '00000000-0000-0000-0000-0000000000a1',
  r2: '00000000-0000-0000-0000-0000000000a2',
  r3: '00000000-0000-0000-0000-0000000000a3',
  r4: '00000000-0000-0000-0000-0000000000a4',
  q1: '00000000-0000-0000-0000-0000000000b1',
  j1: '00000000-0000-0000-0000-0000000000c1',
};

const db = new PGlite();

const PRELUDE = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

create table public.admins (id uuid primary key, disabled_at timestamptz);
create function public.is_admin() returns boolean language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.admins where id = auth.uid() and disabled_at is null) $$;

create table public.profiles (
  id uuid primary key,
  role text not null default 'customer' check (role in ('customer', 'provider')),
  full_name text not null default '', initials text not null default '', area text not null default '',
  is_seed boolean not null default false, provider_category text,
  provider_rating numeric not null default 0, provider_jobs_count int not null default 0, provider_distance_km numeric,
  provider_verified boolean not null default false, provider_certified boolean not null default false,
  created_at timestamptz not null default now(),
  phone text, email text, push_token text, push_permission_status text,
  photo_url text, tagline text,
  verification_level text not null default 'REGISTERED', location text,
  availability_mode text not null default 'SCHEDULE',
  suspended_at timestamptz, suspended_reason text, suspended_by uuid,
  terms_accepted_at timestamptz, terms_version text,
  notification_prefs jsonb not null default '{}'::jsonb, payout_account jsonb,
  customer_rating numeric, customer_reviews_count int not null default 0
);

create table public.organizations (id uuid primary key default gen_random_uuid(), name text not null default '', owner_id uuid);
create table public.organization_members (
  organization_id uuid not null references public.organizations(id), profile_id uuid not null references public.profiles(id),
  primary key (organization_id, profile_id)
);

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  category_id text, category_label text not null default '', description text not null default '',
  photos text[] not null default '{}', budget_min int, budget_max int,
  location_label text not null default '',
  status text not null default 'open'
    check (status in ('open', 'matching', 'quoted', 'awaiting_provider', 'accepted', 'rejected', 'cancelled', 'completed')),
  created_at timestamptz not null default now(), location text,
  match_radius_meters int not null default 10000, matched_at timestamptz,
  preferred_provider_id uuid, request_mode text not null default 'GENERAL',
  customer_budget int, rejection_reason text,
  organization_id uuid references public.organizations(id), project_id uuid,
  preferred_time timestamptz, urgency text not null default 'flexible'
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id),
  provider_id uuid not null references public.profiles(id),
  price int not null, eta_label text not null default '', badge_label text, badge_kind text,
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined')),
  created_at timestamptz not null default now(), note text not null default '',
  revision int not null default 1, updated_at timestamptz not null default now(),
  items jsonb not null default '[]'::jsonb, proposed_start timestamptz,
  counter_price int, counter_note text, counter_at timestamptz, counter_declined_at timestamptz, decline_reason text,
  unique (request_id, provider_id)
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id),
  quote_id uuid not null references public.quotes(id),
  customer_id uuid not null references public.profiles(id),
  provider_id uuid not null references public.profiles(id),
  title text not null default '', price int not null, location_label text not null default '',
  step int not null default 1, status text not null default 'in_progress',
  started_at timestamptz not null default now(), completed_at timestamptz,
  provider_completed_at timestamptz, customer_confirmed_at timestamptz, scheduled_for timestamptz
);

create table public.saved_providers (
  customer_id uuid not null references public.profiles(id), provider_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), primary key (customer_id, provider_id)
);

create table public.request_opportunities (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id),
  provider_id uuid not null references public.profiles(id), status text not null default 'NEW'
);

create table public.reviews (id uuid primary key default gen_random_uuid(), provider_id uuid not null, stars int not null);

-- Supabase grants every API role full access to public tables by default.
grant all on all tables in schema public to anon, authenticated, service_role;

-- The policies as they stand before 0078-0080 (0001, 0013, 0030).
alter table public.profiles enable row level security;
alter table public.service_requests enable row level security;
alter table public.quotes enable row level security;
alter table public.jobs enable row level security;
alter table public.saved_providers enable row level security;
alter table public.request_opportunities enable row level security;

create policy "profiles are publicly readable" on public.profiles for select using (true);
create policy "users can create their own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "users can update their own profile" on public.profiles for update using (auth.uid() = id);

create policy "requests are publicly readable" on public.service_requests for select using (true);
create policy "customers create their own requests" on public.service_requests for insert with check (auth.uid() = customer_id);
create policy "customers update their own requests" on public.service_requests for update using (auth.uid() = customer_id);

create policy "quotes are publicly readable" on public.quotes for select using (true);
create policy "providers or the simulate button can send quotes" on public.quotes for insert
  with check (auth.uid() = provider_id or exists (select 1 from public.profiles where id = provider_id and is_seed = true));

create policy "jobs are publicly readable" on public.jobs for select using (true);
create policy "customers create jobs by accepting a quote" on public.jobs for insert with check (auth.uid() = customer_id);
create policy "customer or provider can update their job" on public.jobs for update using (auth.uid() = customer_id or auth.uid() = provider_id);

create policy "saved providers are publicly readable" on public.saved_providers for select using (true);
create policy "customers manage their own saved providers" on public.saved_providers for insert with check (auth.uid() = customer_id);

create policy "providers read own opportunities" on public.request_opportunities for select
  using (auth.uid() = provider_id or exists (select 1 from public.service_requests r where r.id = request_id and r.customer_id = auth.uid()));

-- Reads on profiles after 0073/0075/0076: every column except these four.
revoke select on public.profiles from anon, authenticated;
do $$
declare col text;
begin
  for col in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name not in ('phone', 'email', 'push_token', 'payout_account')
  loop
    execute format('grant select (%I) on public.profiles to anon, authenticated', col);
  end loop;
end $$;

-- Stand-ins for the real SECURITY DEFINER functions and triggers: they must
-- keep working after direct writes are revoked.
create function public.accept_quote(p_quote uuid) returns void language plpgsql security definer set search_path = public as $$
declare q public.quotes%rowtype; r public.service_requests%rowtype;
begin
  select * into q from public.quotes where id = p_quote;
  select * into r from public.service_requests where id = q.request_id;
  if r.customer_id <> auth.uid() then raise exception 'FORBIDDEN'; end if;
  update public.quotes set status = 'accepted' where id = q.id;
  update public.service_requests set status = 'accepted' where id = r.id;
  insert into public.jobs (request_id, quote_id, customer_id, provider_id, price) values (r.id, q.id, r.customer_id, q.provider_id, q.price);
end $$;
grant execute on function public.accept_quote(uuid) to authenticated;

create function public.mark_request_quoted() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.service_requests set status = 'quoted' where id = new.request_id and status in ('open', 'matching');
  return new;
end $$;
create trigger quotes_mark_request_quoted after insert on public.quotes for each row execute function public.mark_request_quoted();

create function public.apply_review() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set provider_rating = new.stars, provider_jobs_count = provider_jobs_count + 1 where id = new.provider_id;
  return new;
end $$;
create trigger reviews_apply after insert on public.reviews for each row execute function public.apply_review();
grant execute on function public.apply_review() to authenticated;
`;

const FIXTURES = `
insert into public.profiles (id, role, full_name) values
  ('${ID.alice}', 'customer', 'Alice'), ('${ID.bob}', 'customer', 'Bob'), ('${ID.oscar}', 'customer', 'Oscar'),
  ('${ID.pat}', 'provider', 'Pat'), ('${ID.quinn}', 'provider', 'Quinn'), ('${ID.rex}', 'provider', 'Rex'),
  ('${ID.dana}', 'provider', 'Dana'), ('${ID.zed}', 'provider', 'Zed'), ('${ID.ada}', 'customer', 'Ada');
insert into public.admins (id) values ('${ID.ada}');
insert into public.organizations (id, name, owner_id) values ('${ID.org}', 'Alice Ltd', '${ID.alice}');
insert into public.organization_members values ('${ID.org}', '${ID.alice}'), ('${ID.org}', '${ID.oscar}');

insert into public.service_requests (id, customer_id, description, status) values
  ('${ID.r1}', '${ID.alice}', 'Leaking pipe', 'matching'), ('${ID.r2}', '${ID.bob}', 'Fix socket', 'matching');
insert into public.service_requests (id, customer_id, description, status, organization_id) values
  ('${ID.r3}', '${ID.alice}', 'Office wiring', 'matching', '${ID.org}');
insert into public.service_requests (id, customer_id, description, status, preferred_provider_id, request_mode) values
  ('${ID.r4}', '${ID.bob}', 'Direct ask', 'awaiting_provider', '${ID.dana}', 'DIRECT');
insert into public.request_opportunities (request_id, provider_id) values ('${ID.r1}', '${ID.pat}');
insert into public.quotes (id, request_id, provider_id, price) values ('${ID.q1}', '${ID.r1}', '${ID.rex}', 200);
insert into public.jobs (id, request_id, quote_id, customer_id, provider_id, price) values
  ('${ID.j1}', '${ID.r1}', '${ID.q1}', '${ID.alice}', '${ID.rex}', 200);
insert into public.saved_providers (customer_id, provider_id) values ('${ID.alice}', '${ID.pat}');
`;

// ── tiny test harness ───────────────────────────────────────────────────
let failures = 0;
let passes = 0;

/** Runs one statement as a signed-in user ({ id }), or signed out ('anon'). */
async function as(who, sql) {
  const role = who === 'anon' ? 'anon' : 'authenticated';
  const sub = who === 'anon' ? '' : who;
  await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.sub', '${sub}', false);`);
  try {
    const r = await db.query(sql);
    return { ok: true, rows: r.rows, count: r.rows.length > 0 ? r.rows.length : (r.affectedRows ?? 0) };
  } catch (e) {
    return { ok: false, error: String(e.message ?? e) };
  } finally {
    await db.exec('reset role');
  }
}

function check(name, condition, detail = '') {
  if (condition) {
    passes += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`);
  }
}

const denied = (r) => !r.ok && /permission denied/i.test(r.error);
const rlsBlocked = (r) => !r.ok && /row-level security|violates check/i.test(r.error);
const ids = (r) => (r.rows ?? []).map((x) => x.id).sort();

async function main() {
  await db.exec(PRELUDE);
  await db.exec(FIXTURES);
  for (const file of ['0078_lock_down_profile_writes.sql', '0079_lock_down_marketplace_writes.sql', '0080_restrict_marketplace_reads.sql']) {
    await db.exec(migration(file));
  }
  // Migrations must be safe to re-run.
  for (const file of ['0078_lock_down_profile_writes.sql', '0079_lock_down_marketplace_writes.sql', '0080_restrict_marketplace_reads.sql']) {
    await db.exec(migration(file));
  }

  console.log('\nprofiles - what a user can write');
  let r = await as(ID.pat, `update public.profiles set full_name = 'Patrick', tagline = 'Fast', area = 'Osu' where id = '${ID.pat}' returning id`);
  check('update own name, tagline and area', r.ok && r.count === 1, r.error);
  r = await as(ID.pat, `update public.profiles set phone = '0241234567', email = 'p@x.com', push_token = 'tok', notification_prefs = '{"a":1}', payout_account = '{"type":"momo"}', photo_url = 'u', role = 'customer' where id = '${ID.pat}' returning id`);
  check('update own phone, email, push, prefs, payout account, photo and role', r.ok && r.count === 1, r.error);
  for (const col of ['provider_verified = true', 'provider_certified = true', "verification_level = 'SOLID_CONNECT_VERIFIED'", 'provider_rating = 5', 'provider_jobs_count = 999', 'customer_rating = 5', 'suspended_at = null', 'is_seed = true', "availability_mode = 'AVAILABLE_NOW'"]) {
    r = await as(ID.pat, `update public.profiles set ${col} where id = '${ID.pat}'`);
    check(`cannot set ${col.split(' ')[0]} on own profile`, denied(r), r.ok ? 'it worked' : r.error);
  }
  r = await as(ID.pat, `update public.profiles set full_name = 'Hacked' where id = '${ID.quinn}'`);
  check("cannot edit someone else's profile", r.ok && r.count === 0, r.error);
  r = await as('anon', `update public.profiles set full_name = 'x' where id = '${ID.pat}'`);
  check('signed-out caller cannot update a profile', denied(r) || (r.ok && r.count === 0), r.error);

  const newId = '00000000-0000-0000-0000-0000000000aa';
  r = await as(newId, `insert into public.profiles (id, role, full_name, initials, phone, email, area, provider_category, terms_accepted_at, terms_version) values ('${newId}', 'provider', 'Newbie', 'N', '024', 'n@x', 'Accra', 'Plumbing', now(), 'v1') returning id`);
  check('sign-up can create own profile', r.ok && r.count === 1, r.error);
  const evil = '00000000-0000-0000-0000-0000000000ab';
  r = await as(evil, `insert into public.profiles (id, role, provider_verified) values ('${evil}', 'provider', true)`);
  check('cannot create a profile that starts verified', denied(r), r.ok ? 'it worked' : r.error);
  r = await as(evil, `insert into public.profiles (id, role, verification_level) values ('${evil}', 'provider', 'SOLID_CONNECT_VERIFIED')`);
  check('cannot create a profile at a higher verification level', denied(r), r.ok ? 'it worked' : r.error);
  r = await as(evil, `insert into public.profiles (id, role, is_seed) values ('${evil}', 'provider', true)`);
  check('cannot create a profile flagged is_seed', denied(r), r.ok ? 'it worked' : r.error);
  r = await as(evil, `insert into public.profiles (id, role) values ('${ID.pat}', 'provider')`);
  check("cannot create a profile with someone else's id", !r.ok, 'it worked');

  // Sign-up inserts the profile and, if it already exists, updates it (src/api/profile.ts).
  r = await as(ID.quinn, `insert into public.profiles (id, role, full_name, initials, phone, email, area, provider_category, terms_accepted_at, terms_version) values ('${ID.quinn}', 'provider', 'Quinn Q', 'QQ', '024', 'q@x', 'Accra', 'Electrical', now(), 'v1') returning id`);
  check('sign-up insert for a profile that already exists is refused by the primary key (app then updates)', !r.ok && /profiles_pkey|duplicate key/i.test(r.error), r.error);
  r = await as(ID.quinn, `update public.profiles set role = 'provider', full_name = 'Quinn Q', initials = 'QQ', phone = '024', email = 'q@x', area = 'Accra', provider_category = 'Electrical', terms_accepted_at = now(), terms_version = 'v1' where id = '${ID.quinn}' returning id, full_name`);
  check("sign-up's update of an existing profile works (every column it sends)", r.ok && r.count === 1, r.error);
  // Guard: an upsert that names phone/email needs read access to them, which app users
  // don't have (0073/0076). If this ever starts passing, the access rules changed.
  r = await as(ID.quinn, `insert into public.profiles (id, role, phone) values ('${ID.quinn}', 'provider', '024') on conflict (id) do update set phone = excluded.phone`);
  check('an upsert naming phone is not usable by app users (so the app must not use one)', denied(r), r.ok ? 'it worked' : r.error);

  r = await as(ID.alice, `insert into public.reviews (provider_id, stars) values ('${ID.pat}', 4)`);
  const rating = await db.query(`select provider_rating from public.profiles where id = '${ID.pat}'`);
  check('a review still updates the provider rating (definer trigger)', r.ok && Number(rating.rows[0].provider_rating) === 4, r.error);

  console.log('\njobs - writes');
  r = await as(ID.rex, `update public.jobs set status = 'completed', price = 99999 where id = '${ID.j1}'`);
  check('provider cannot edit a job directly', denied(r), r.ok ? 'it worked' : r.error);
  r = await as(ID.alice, `update public.jobs set price = 1 where id = '${ID.j1}'`);
  check('customer cannot edit a job directly', denied(r), r.ok ? 'it worked' : r.error);
  r = await as(ID.alice, `insert into public.jobs (request_id, quote_id, customer_id, provider_id, price) values ('${ID.r1}', '${ID.q1}', '${ID.alice}', '${ID.rex}', 1)`);
  check('cannot create a job directly', denied(r), r.ok ? 'it worked' : r.error);
  r = await as(ID.alice, `delete from public.jobs where id = '${ID.j1}'`);
  check('cannot delete a job directly', denied(r), r.ok ? 'it worked' : r.error);

  // Belt and braces: even if someone later re-grants the write privileges, there
  // is no policy left that lets a row change.
  await db.exec('grant insert, update, delete on public.jobs, public.quotes, public.service_requests to authenticated');
  r = await as(ID.rex, `update public.jobs set price = 1 where id = '${ID.j1}'`);
  check('with privileges re-granted, a job update still changes nothing (no policy allows it)', r.ok && r.count === 0, r.error);
  r = await as(ID.rex, `update public.quotes set price = 1 where id = '${ID.q1}'`);
  check('...nor a quote update', r.ok && r.count === 0, r.error);
  r = await as(ID.alice, `update public.service_requests set status = 'completed' where id = '${ID.r1}'`);
  check('...nor a request update', r.ok && r.count === 0, r.error);
  r = await as(ID.rex, `delete from public.jobs where id = '${ID.j1}'`);
  check('...nor a job delete', r.ok && r.count === 0, r.error);
  await db.exec('revoke insert, update, delete on public.jobs, public.quotes, public.service_requests from authenticated');
  await db.exec(`grant insert (request_id, provider_id, price, eta_label, badge_label, badge_kind, note, items, proposed_start) on public.quotes to authenticated;
    grant insert (customer_id, category_id, category_label, description, photos, budget_min, budget_max, customer_budget, location_label, preferred_provider_id, preferred_time, urgency, request_mode, status) on public.service_requests to authenticated;`);

  console.log('\nquotes - writes');
  r = await as(ID.quinn, `insert into public.quotes (request_id, provider_id, price, eta_label, badge_label, badge_kind, note, items, proposed_start) values ('${ID.r2}', '${ID.quinn}', 150, 'Today', null, null, 'hi', '[]', null) returning id`);
  check('provider can send their own quote (every column the app sends)', r.ok && r.count === 1, r.error);
  const reqAfter = await db.query(`select status from public.service_requests where id = '${ID.r2}'`);
  check('...and the definer trigger still marks the request quoted', reqAfter.rows[0].status === 'quoted');
  r = await as(ID.quinn, `insert into public.quotes (request_id, provider_id, price) values ('${ID.r1}', '${ID.pat}', 1)`);
  check('provider cannot send a quote as someone else', rlsBlocked(r), r.ok ? 'it worked' : r.error);
  r = await as(ID.quinn, `insert into public.quotes (request_id, provider_id, price, status) values ('${ID.r1}', '${ID.quinn}', 1, 'accepted')`);
  check('provider cannot send a quote that is already accepted', denied(r), r.ok ? 'it worked' : r.error);
  r = await as(ID.quinn, `insert into public.quotes (request_id, provider_id, price, counter_price) values ('${ID.r3}', '${ID.quinn}', 1, 1)`);
  check('provider cannot pre-fill counter-offer fields', denied(r), r.ok ? 'it worked' : r.error);
  r = await as(ID.rex, `update public.quotes set price = 1, status = 'accepted' where id = '${ID.q1}'`);
  check('provider cannot edit a quote directly', denied(r), r.ok ? 'it worked' : r.error);
  r = await as(ID.alice, `update public.quotes set price = 1 where id = '${ID.q1}'`);
  check('customer cannot edit a quote directly', denied(r), r.ok ? 'it worked' : r.error);
  r = await as(ID.rex, `delete from public.quotes where id = '${ID.q1}'`);
  check('cannot delete a quote directly', denied(r), r.ok ? 'it worked' : r.error);
  r = await as('anon', `insert into public.quotes (request_id, provider_id, price) values ('${ID.r1}', '${ID.rex}', 1)`);
  check('signed-out caller cannot send a quote', !r.ok, 'it worked');

  console.log('\nservice_requests - writes');
  r = await as(ID.bob, `insert into public.service_requests (customer_id, category_id, category_label, description, photos, budget_min, budget_max, customer_budget, location_label, preferred_provider_id, preferred_time, urgency, request_mode, status) values ('${ID.bob}', 'c', 'Plumbing', 'd', '{}', 100, 100, 100, 'Osu', null, null, 'flexible', 'GENERAL', 'matching') returning id`);
  check('customer can open a request (every column the app sends)', r.ok && r.count === 1, r.error);
  r = await as(ID.bob, `insert into public.service_requests (customer_id, description, status) values ('${ID.bob}', 'd', 'accepted')`);
  check('customer cannot create a request that is already accepted', rlsBlocked(r), r.ok ? 'it worked' : r.error);
  r = await as(ID.bob, `insert into public.service_requests (customer_id, description, status) values ('${ID.alice}', 'd', 'matching')`);
  check('customer cannot open a request as someone else', rlsBlocked(r), r.ok ? 'it worked' : r.error);
  r = await as(ID.bob, `insert into public.service_requests (customer_id, description, status, organization_id) values ('${ID.bob}', 'd', 'matching', '${ID.org}')`);
  check("customer cannot attach a request to someone else's organization", denied(r), r.ok ? 'it worked' : r.error);
  r = await as(ID.alice, `update public.service_requests set status = 'completed' where id = '${ID.r1}'`);
  check('customer cannot edit a request directly', denied(r), r.ok ? 'it worked' : r.error);
  r = await as(ID.rex, `update public.service_requests set status = 'quoted' where id = '${ID.r1}'`);
  check('provider cannot edit a request directly', denied(r), r.ok ? 'it worked' : r.error);

  console.log('\nservice_requests - who can read');
  const readable = async (who) => ids(await as(who, `select id from public.service_requests where id in ('${ID.r1}','${ID.r2}','${ID.r3}','${ID.r4}')`));
  check('customer sees their own requests, not another customer\'s', JSON.stringify(await readable(ID.alice)) === JSON.stringify([ID.r1, ID.r3].sort()));
  check("other customer sees only theirs", JSON.stringify(await readable(ID.bob)) === JSON.stringify([ID.r2, ID.r4].sort()));
  check('matched provider sees the request they were matched to', JSON.stringify(await readable(ID.pat)) === JSON.stringify([ID.r1]));
  check('provider who quoted sees that request', JSON.stringify(await readable(ID.rex)) === JSON.stringify([ID.r1]));
  check('provider with no link sees nothing', (await readable(ID.zed)).length === 0);
  check('direct-request provider sees the request sent to them', JSON.stringify(await readable(ID.dana)) === JSON.stringify([ID.r4]));
  check("organization member sees the organization's request", JSON.stringify(await readable(ID.oscar)) === JSON.stringify([ID.r3]));
  check('admin sees every request', (await readable(ID.ada)).length === 4);
  r = await as('anon', `select id from public.service_requests`);
  check('signed-out caller cannot read requests', denied(r) || (r.ok && r.count === 0), r.error);

  console.log('\nquotes - who can read');
  const quotesFor = async (who) => ids(await as(who, `select id from public.quotes where request_id = '${ID.r1}'`));
  check('the request\'s customer sees quotes on it', JSON.stringify(await quotesFor(ID.alice)) === JSON.stringify([ID.q1]));
  check('the provider who wrote it sees it', JSON.stringify(await quotesFor(ID.rex)) === JSON.stringify([ID.q1]));
  check('a competing, matched provider does NOT see it', (await quotesFor(ID.pat)).length === 0);
  check('an unrelated customer does not see it', (await quotesFor(ID.bob)).length === 0);
  check('admin sees it', JSON.stringify(await quotesFor(ID.ada)) === JSON.stringify([ID.q1]));
  r = await as('anon', `select id from public.quotes`);
  check('signed-out caller cannot read quotes', denied(r) || (r.ok && r.count === 0), r.error);

  console.log('\njobs - who can read');
  const jobsFor = async (who) => ids(await as(who, `select id from public.jobs`));
  check('customer sees their job', JSON.stringify(await jobsFor(ID.alice)) === JSON.stringify([ID.j1]));
  check('provider sees their job', JSON.stringify(await jobsFor(ID.rex)) === JSON.stringify([ID.j1]));
  check('a matched provider who lost does not see the job', (await jobsFor(ID.pat)).length === 0);
  check('an unrelated customer does not see the job', (await jobsFor(ID.bob)).length === 0);
  check('admin sees the job', JSON.stringify(await jobsFor(ID.ada)) === JSON.stringify([ID.j1]));
  r = await as('anon', `select id from public.jobs`);
  check('signed-out caller cannot read jobs', denied(r) || (r.ok && r.count === 0), r.error);
  await db.exec(`insert into public.quotes (id, request_id, provider_id, price) values ('00000000-0000-0000-0000-0000000000b3', '${ID.r3}', '${ID.rex}', 50);
    insert into public.jobs (id, request_id, quote_id, customer_id, provider_id, price) values ('00000000-0000-0000-0000-0000000000c3', '${ID.r3}', '00000000-0000-0000-0000-0000000000b3', '${ID.alice}', '${ID.rex}', 50);`);
  check('organization member sees the organization job', JSON.stringify(await jobsFor(ID.oscar)) === JSON.stringify(['00000000-0000-0000-0000-0000000000c3']));

  console.log('\nsaved_providers');
  r = await as(ID.alice, `select provider_id from public.saved_providers`);
  check('customer sees their saved providers', r.ok && r.count === 1, r.error);
  r = await as(ID.bob, `select provider_id from public.saved_providers`);
  check("another customer cannot see them", r.ok && r.count === 0, r.error);
  r = await as(ID.ada, `select provider_id from public.saved_providers`);
  check('admin can see them', r.ok && r.count === 1, r.error);
  r = await as('anon', `select * from public.saved_providers`);
  check('signed-out caller cannot read them', denied(r) || (r.ok && r.count === 0), r.error);
  r = await as(ID.bob, `insert into public.saved_providers (customer_id, provider_id) values ('${ID.bob}', '${ID.pat}') returning provider_id`);
  check('customer can still save a provider', r.ok && r.count === 1, r.error);

  console.log('\nflows that must keep working');
  const quinnQuote = (await db.query(`select id from public.quotes where request_id = '${ID.r2}' and provider_id = '${ID.quinn}'`)).rows[0].id;
  r = await as(ID.bob, `select public.accept_quote('${quinnQuote}')`);
  const after = await db.query(`select (select status from public.quotes where id = '${quinnQuote}') as quote, (select status from public.service_requests where id = '${ID.r2}') as request, (select count(*)::int from public.jobs where quote_id = '${quinnQuote}') as jobs`);
  check('accept_quote (definer) still accepts the quote, closes the request and creates the job', r.ok && after.rows[0].quote === 'accepted' && after.rows[0].request === 'accepted' && after.rows[0].jobs === 1, r.error ?? JSON.stringify(after.rows[0]));
  r = await as(ID.quinn, `select public.accept_quote('${quinnQuote}')`);
  check("a provider cannot call accept_quote for someone else's request", !r.ok && /FORBIDDEN/.test(r.error), r.error);
  r = await as(ID.alice, `select ro.status from public.request_opportunities ro join public.service_requests sr on sr.id = ro.request_id where sr.id = '${ID.r1}'`);
  check("a customer can read opportunities on their own request (policy chain doesn't recurse)", r.ok && r.count === 1, r.error);
  r = await as(ID.pat, `select ro.status from public.request_opportunities ro where ro.provider_id = '${ID.pat}'`);
  check('a provider can read their own opportunities', r.ok && r.count === 1, r.error);
  r = await as(ID.rex, `select j.id from public.jobs j join public.service_requests sr on sr.id = j.request_id join public.quotes q on q.id = j.quote_id where j.provider_id = '${ID.rex}'`);
  check("a provider can join their job to its request and quote (no recursion)", r.ok && r.count >= 1, r.error);

  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
