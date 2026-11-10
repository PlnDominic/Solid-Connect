// Tests for migration 0088_hardening.sql. Runs the real migration on PGlite
// over a reduced copy of the tables it touches.
//
//   node supabase/tests/hardening.test.mjs

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
const db = new PGlite();

const ID = {
  cust: '00000000-0000-0000-0000-00000000a001', // customer
  prov: '00000000-0000-0000-0000-00000000d004', // provider
  prov2: '00000000-0000-0000-0000-00000000e005', // another provider
  stranger: '00000000-0000-0000-0000-00000000b002', // unrelated customer
  both: '00000000-0000-0000-0000-00000000c003', // a provider who also posts requests
  suspended: '00000000-0000-0000-0000-00000000f006', // suspended provider
};

const PRELUDE = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable
  as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated') $$;
grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;

create schema storage;
create table storage.buckets (id text primary key, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
insert into storage.buckets (id, public) values
  ('profile-photos', true), ('portfolio-photos', true), ('request-photos', true), ('chat-photos', true),
  ('chat-audio', true), ('dispute-evidence', false), ('verification-docs', false);

create table public.profiles (
  id uuid primary key,
  role text not null default 'customer',
  suspended_at timestamptz,
  customer_rating numeric(2,1) not null default 4.8,
  customer_reviews_count int not null default 0
);
create table public.organization_members (organization_id uuid, profile_id uuid);
create table public.user_blocks (blocker_id uuid not null, blocked_id uuid not null);
create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null, status text not null default 'open', preferred_provider_id uuid,
  organization_id uuid, category_label text not null default 'Plumbing', location_label text not null default 'Osu',
  request_mode text not null default 'GENERAL', customer_budget int, budget_min int, budget_max int, location text
);
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null, provider_id uuid not null, price int not null default 100,
  eta_label text, badge_label text, badge_kind text, status text not null default 'sent',
  note text, revision int, updated_at timestamptz not null default now()
);
create table public.request_opportunities (request_id uuid, provider_id uuid, status text);
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null, quote_id uuid, customer_id uuid not null, provider_id uuid not null,
  title text not null default '', price int not null default 100, location_label text not null default '',
  step int not null default 1, status text not null default 'accepted',
  started_at timestamptz not null default now(), provider_completed_at timestamptz, customer_confirmed_at timestamptz
);
create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  request_id uuid, provider_id uuid, customer_id uuid, job_id uuid, unique (request_id, provider_id)
);
create table public.chat_messages (thread_id uuid, sender_id uuid, read_at timestamptz);
create table public.job_events (job_id uuid, actor_id uuid, event_type text, from_step int, to_step int, note text);
create table public.notifications (user_id uuid, type text, title text, body text, data jsonb, created_at timestamptz not null default now());
create table public.reviews (id uuid primary key default gen_random_uuid(), job_id uuid not null unique, provider_id uuid not null, customer_id uuid not null, rating int not null);
create table public.customer_reviews (id uuid primary key default gen_random_uuid(), job_id uuid not null unique, provider_id uuid not null, customer_id uuid not null, rating int not null);
create table public.referrals (
  id uuid primary key default gen_random_uuid(), referrer_id uuid not null, referred_id uuid not null,
  status text not null default 'pending', job_id uuid, reward_amount int, earned_at timestamptz
);
create table public.platform_config (id boolean primary key default true);
insert into public.platform_config (id) values (true);
create table public.provider_subs (provider_id uuid, expires_at timestamptz);
create table public.area_centroids (name text, location text);
insert into public.area_centroids values ('Osu', 'POINT(1 1)');

-- Stand-ins for objects from earlier migrations.
create function public.provider_subscription_expiry(p_provider_id uuid) returns timestamptz language sql stable
  as $$ select max(expires_at) from public.provider_subs where provider_id = p_provider_id $$;
create function public.provider_trial_used(p_provider_id uuid) returns boolean language sql stable
  as $$ select exists (select 1 from public.jobs where provider_id = p_provider_id and status <> 'cancelled') $$;
create function public.phone_in_use(p_phone text, p_exclude uuid default null) returns boolean language sql as $$ select false $$;
create function public.email_in_use(p_email text, p_exclude uuid default null) returns boolean language sql as $$ select false $$;
revoke all on function public.phone_in_use(text, uuid), public.email_in_use(text, uuid) from public;
grant execute on function public.phone_in_use(text, uuid), public.email_in_use(text, uuid) to anon, authenticated;
create function public.is_blocked_between(p_a uuid, p_b uuid) returns boolean language sql stable as $$ select false $$;
create function public.count_unread_threads(p_user_id uuid, p_role text) returns integer language sql as $$ select 0 $$;
create function public.set_request_location_from_label(p_request_id uuid) returns void language sql as $$ select $$;

alter table public.quotes enable row level security;
grant select, insert on public.quotes to authenticated;
grant select on public.service_requests, public.profiles, public.jobs, public.chat_threads, public.chat_messages to authenticated;
grant insert on public.reviews, public.customer_reviews to authenticated;
grant all on public.platform_config to authenticated;
create policy "read all quotes" on public.quotes for select using (true);
create policy "providers send their own quotes" on public.quotes for insert to authenticated with check (auth.uid() = provider_id);
alter table public.reviews enable row level security;
alter table public.customer_reviews enable row level security;
create policy "review insert" on public.reviews for insert to authenticated with check (auth.uid() = customer_id);
create policy "customer review insert" on public.customer_reviews for insert to authenticated with check (auth.uid() = provider_id);

create trigger referrals_earn_on_completion after update on public.jobs
  for each row execute function public.noop_placeholder();
`.replace(
  `create trigger referrals_earn_on_completion after update on public.jobs
  for each row execute function public.noop_placeholder();`,
  '',
);

const FIXTURES = `
insert into public.profiles (id, role, suspended_at) values
  ('${ID.cust}', 'customer', null), ('${ID.prov}', 'provider', null), ('${ID.prov2}', 'provider', null),
  ('${ID.stranger}', 'customer', null), ('${ID.both}', 'provider', null), ('${ID.suspended}', 'provider', now());
`;

let failures = 0;
let passes = 0;
function check(name, ok, detail = '') {
  if (ok) {
    passes += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`);
  }
}

async function as(who, sql, role = 'authenticated') {
  const db_role = who === 'anon' ? 'anon' : 'authenticated';
  const sub = who === 'anon' ? '' : who;
  await db.exec(`reset role; set role ${db_role}; select set_config('request.jwt.claim.sub', '${sub}', false), set_config('request.jwt.claim.role', '${role}', false)`);
  try {
    const r = await db.query(sql);
    return { ok: true, rows: r.rows };
  } catch (e) {
    return { ok: false, error: String(e.message ?? e) };
  } finally {
    await db.exec('reset role');
  }
}
const one = async (sql) => (await db.query(sql)).rows[0];
const refused = (r) => !r.ok && /REVIEW_NOT_ALLOWED|row-level security|violates|SUBSCRIPTION_REQUIRED|CANNOT_|permission denied/i.test(r.error);

async function mkRequest(customer, extra = {}) {
  const cols = { status: 'open', ...extra };
  return (await one(`insert into public.service_requests (customer_id, status, preferred_provider_id, request_mode, customer_budget)
    values ('${customer}', '${cols.status}', ${cols.preferred ? `'${cols.preferred}'` : 'null'}, '${cols.mode ?? 'GENERAL'}', ${cols.budget ?? 'null'}) returning id`)).id;
}
async function mkJob(customer, provider, status = 'completed') {
  const req = await mkRequest(customer, { status: 'accepted' });
  return (await one(`insert into public.jobs (request_id, customer_id, provider_id, status, customer_confirmed_at)
    values ('${req}', '${customer}', '${provider}', '${status}', ${status === 'completed' ? 'now()' : 'null'}) returning id`)).id;
}

async function main() {
  await db.exec(PRELUDE);
  await db.exec(FIXTURES);
  const sql = readFileSync(join(here, '..', 'migrations', '0088_hardening.sql'), 'utf8');
  await db.exec(sql);
  await db.exec(sql); // safe to re-run

  console.log('\nA. reviews');
  const done = await mkJob(ID.cust, ID.prov);
  const open = await mkJob(ID.cust, ID.prov2, 'in_progress');
  let r = await as(ID.cust, `insert into public.reviews (job_id, provider_id, customer_id, rating) values ('${done}', '${ID.prov}', '${ID.cust}', 5)`);
  check('a customer can review the provider of their completed job', r.ok, r.error);
  const done2 = await mkJob(ID.cust, ID.prov);
  r = await as(ID.cust, `insert into public.reviews (job_id, provider_id, customer_id, rating) values ('${done2}', '${ID.prov2}', '${ID.cust}', 1)`);
  check('cannot review a different provider than the job was with', refused(r), r.ok ? 'it worked' : r.error);
  r = await as(ID.cust, `insert into public.reviews (job_id, provider_id, customer_id, rating) values ('${open}', '${ID.prov2}', '${ID.cust}', 1)`);
  check('cannot review a job that is not completed', refused(r), r.ok ? 'it worked' : r.error);
  r = await as(ID.stranger, `insert into public.reviews (job_id, provider_id, customer_id, rating) values ('${done2}', '${ID.prov}', '${ID.stranger}', 1)`);
  check("cannot review someone else's job", refused(r), r.ok ? 'it worked' : r.error);
  r = await as(ID.cust, `insert into public.reviews (job_id, provider_id, customer_id, rating) values (gen_random_uuid(), '${ID.prov}', '${ID.cust}', 1)`);
  check('cannot review a job that does not exist', !r.ok, r.ok ? 'it worked' : r.error);
  r = await as(ID.prov, `insert into public.customer_reviews (job_id, provider_id, customer_id, rating) values ('${done}', '${ID.prov}', '${ID.cust}', 4)`);
  check('a provider can rate the customer of their completed job', r.ok, r.error);
  r = await as(ID.prov2, `insert into public.customer_reviews (job_id, provider_id, customer_id, rating) values ('${done2}', '${ID.prov2}', '${ID.cust}', 1)`);
  check('a provider cannot rate a customer for a job they did not do', refused(r), r.ok ? 'it worked' : r.error);

  console.log('\nB. self-dealing');
  r = await as(ID.both, `insert into public.service_requests (customer_id) values ('${ID.both}') returning id`);
  await db.exec(`reset role`);
  const ownReq = await mkRequest(ID.both);
  r = await as(ID.both, `insert into public.quotes (request_id, provider_id) values ('${ownReq}', '${ID.both}')`);
  check('cannot quote your own request', refused(r), r.ok ? 'it worked' : r.error);
  const req = await mkRequest(ID.cust);
  r = await as(ID.prov, `insert into public.quotes (request_id, provider_id) values ('${req}', '${ID.prov}')`);
  check('a provider can quote someone else\'s open request', r.ok, r.error);
  r = await as(ID.stranger, `insert into public.quotes (request_id, provider_id) values ('${req}', '${ID.stranger}')`);
  check('a customer account cannot send quotes', refused(r), r.ok ? 'it worked' : r.error);
  r = await as(ID.suspended, `insert into public.quotes (request_id, provider_id) values ('${req}', '${ID.suspended}')`);
  check('a suspended provider cannot quote', refused(r), r.ok ? 'it worked' : r.error);
  const closed = await mkRequest(ID.cust, { status: 'accepted' });
  r = await as(ID.prov2, `insert into public.quotes (request_id, provider_id) values ('${closed}', '${ID.prov2}')`);
  check('cannot quote a request that is no longer open', refused(r), r.ok ? 'it worked' : r.error);
  const direct = await mkRequest(ID.cust, { preferred: ID.prov, mode: 'DIRECT' });
  r = await as(ID.prov2, `insert into public.quotes (request_id, provider_id) values ('${direct}', '${ID.prov2}')`);
  check('cannot quote a request sent directly to someone else', refused(r), r.ok ? 'it worked' : r.error);
  r = await as(ID.prov, `insert into public.quotes (request_id, provider_id) values ('${req}', '${ID.prov2}')`);
  check('cannot send a quote as another provider', refused(r), r.ok ? 'it worked' : r.error);
  await db.exec(`insert into public.user_blocks values ('${ID.cust}', '${ID.prov2}')`);
  r = await as(ID.prov2, `insert into public.quotes (request_id, provider_id) values ('${req}', '${ID.prov2}')`);
  check('a provider the customer blocked cannot quote them', refused(r), r.ok ? 'it worked' : r.error);
  await db.exec(`delete from public.user_blocks`);

  console.log('\naccepting');
  const selfReq = await mkRequest(ID.both);
  const selfQuote = (await one(`insert into public.quotes (request_id, provider_id) values ('${selfReq}', '${ID.both}') returning id`)).id;
  r = await as(ID.both, `select public.accept_quote('${selfQuote}', '${ID.both}')`);
  check('cannot accept your own quote', !r.ok && /CANNOT_ACCEPT_OWN_QUOTE/.test(r.error), r.error);
  const realQuote = (await one(`select id from public.quotes where request_id = '${req}' and provider_id = '${ID.prov}'`)).id;
  r = await as(ID.cust, `select public.accept_quote('${realQuote}', '${ID.cust}')`);
  check('a customer can accept a real quote', r.ok, r.error);
  const dreq = await mkRequest(ID.both, { status: 'awaiting_provider', preferred: ID.both, mode: 'DIRECT', budget: 200 });
  r = await as(ID.both, `select public.accept_direct_request('${dreq}', '${ID.both}')`);
  check('cannot accept your own direct request', !r.ok && /CANNOT_ACCEPT_OWN_REQUEST/.test(r.error), r.error);
  r = await db.exec(`do $$ begin insert into public.jobs (request_id, customer_id, provider_id) values (gen_random_uuid(), '${ID.both}', '${ID.both}'); exception when check_violation then raise exception 'BLOCKED'; end $$`).then(() => ({ ok: true })).catch((e) => ({ ok: false, error: String(e.message) }));
  check('the database refuses a job where both sides are the same person', !r.ok && /BLOCKED|violates check/.test(r.error), r.ok ? 'it worked' : r.error);

  console.log('\nD. subscription gate');
  const prov3 = '00000000-0000-0000-0000-00000000a777';
  await db.exec(`insert into public.profiles (id, role) values ('${prov3}', 'provider')`);
  await mkJob(ID.cust, prov3, 'in_progress'); // trial used
  const req2 = await mkRequest(ID.stranger);
  r = await as(prov3, `insert into public.quotes (request_id, provider_id) values ('${req2}', '${prov3}')`);
  check('with the switch off, a provider whose free job is used can still quote', r.ok, r.error);
  await db.exec(`update public.platform_config set subscription_required = true`);
  const req3 = await mkRequest(ID.stranger);
  r = await as(prov3, `insert into public.quotes (request_id, provider_id) values ('${req3}', '${prov3}')`);
  check('with the switch on, they are refused', !r.ok && /SUBSCRIPTION_REQUIRED/.test(r.error), r.error);
  await db.exec(`insert into public.provider_subs values ('${prov3}', now() + interval '30 days')`);
  r = await as(prov3, `insert into public.quotes (request_id, provider_id) values ('${req3}', '${prov3}')`);
  check('an active subscription lets them quote again', r.ok, r.error);
  await db.exec(`update public.provider_subs set expires_at = now() - interval '1 day'`);
  const req4 = await mkRequest(ID.stranger);
  r = await as(prov3, `insert into public.quotes (request_id, provider_id) values ('${req4}', '${prov3}')`);
  check('an expired subscription does not', !r.ok && /SUBSCRIPTION_REQUIRED/.test(r.error), r.error);
  const fresh = '00000000-0000-0000-0000-00000000a888';
  await db.exec(`insert into public.profiles (id, role) values ('${fresh}', 'provider')`);
  r = await as(fresh, `insert into public.quotes (request_id, provider_id) values ('${req4}', '${fresh}')`);
  check('a provider with their free job still unused can quote', r.ok, r.error);
  const dreq2 = await mkRequest(ID.stranger, { status: 'awaiting_provider', preferred: prov3, mode: 'DIRECT', budget: 300 });
  r = await as(prov3, `select public.accept_direct_request('${dreq2}', '${prov3}')`);
  check('direct requests need the subscription too', !r.ok && /SUBSCRIPTION_REQUIRED/.test(r.error), r.error);
  await db.exec(`update public.platform_config set subscription_required = false`);

  console.log('\nC. referral rewards');
  await db.exec(`create trigger referrals_earn_on_completion after update on public.jobs
    for each row execute function public.maybe_earn_referral_reward()`);
  const friend = '00000000-0000-0000-0000-00000000c111';
  const referrer = '00000000-0000-0000-0000-00000000c222';
  await db.exec(`insert into public.profiles (id, role) values ('${friend}', 'customer'), ('${referrer}', 'customer')`);
  const complete = async (customer, provider, minutes) => {
    const rq = await mkRequest(customer, { status: 'accepted' });
    const jid = (await one(`insert into public.jobs (request_id, customer_id, provider_id, status, started_at)
      values ('${rq}', '${customer}', '${provider}', 'in_progress', now() - interval '${minutes} minutes') returning id`)).id;
    await db.exec(`update public.jobs set status = 'completed', customer_confirmed_at = now(), provider_completed_at = now() where id = '${jid}'`);
  };
  await db.exec(`insert into public.referrals (referrer_id, referred_id) values ('${referrer}', '${friend}')`);
  await complete(friend, ID.prov, 3);
  check('a job that finished in minutes earns nothing', (await one(`select status from public.referrals where referred_id = '${friend}'`)).status === 'pending');
  const friend2 = '00000000-0000-0000-0000-00000000c333';
  await db.exec(`insert into public.profiles (id, role) values ('${friend2}', 'customer')`);
  await db.exec(`insert into public.referrals (referrer_id, referred_id) values ('${referrer}', '${friend2}')`);
  await complete(friend2, referrer, 90);
  check('a job the referrer worked themselves earns nothing', (await one(`select status from public.referrals where referred_id = '${friend2}'`)).status === 'pending');
  const friend3 = '00000000-0000-0000-0000-00000000c444';
  await db.exec(`insert into public.profiles (id, role) values ('${friend3}', 'customer')`);
  await db.exec(`insert into public.referrals (referrer_id, referred_id) values ('${referrer}', '${friend3}')`);
  await complete(friend3, ID.prov, 90);
  const earned = await one(`select status, reward_amount from public.referrals where referred_id = '${friend3}'`);
  check('a genuine first job earns the reward', earned.status === 'earned' && earned.reward_amount === 10, JSON.stringify(earned));
  const msg = await one(`select body from public.notifications where type = 'REFERRAL_REWARD_EARNED'`);
  check('the message no longer promises a payout', !!msg && !/payout/i.test(msg.body), msg?.body);
  const capper = '00000000-0000-0000-0000-00000000c555';
  await db.exec(`insert into public.profiles (id, role) values ('${capper}', 'customer')`);
  for (let i = 0; i < 25; i += 1) {
    await db.exec(`insert into public.referrals (referrer_id, referred_id, status) values ('${capper}', gen_random_uuid(), 'earned')`);
  }
  const friend4 = '00000000-0000-0000-0000-00000000c666';
  await db.exec(`insert into public.profiles (id, role) values ('${friend4}', 'customer')`);
  await db.exec(`insert into public.referrals (referrer_id, referred_id) values ('${capper}', '${friend4}')`);
  await complete(friend4, ID.prov, 90);
  check('a referrer over the 25-reward cap earns nothing more', (await one(`select status from public.referrals where referred_id = '${friend4}'`)).status === 'pending');

  console.log('\nE. storage limits');
  const limit = async (id) => one(`select file_size_limit::bigint as size, allowed_mime_types as types from storage.buckets where id = '${id}'`);
  let b = await limit('chat-photos');
  check('chat photos: 8 MB, images only', Number(b.size) === 8 * 1024 * 1024 && b.types.includes('image/jpeg') && !b.types.includes('video/mp4'), JSON.stringify(b));
  b = await limit('chat-audio');
  check('chat audio: 10 MB, includes the m4a type the app sends', Number(b.size) === 10 * 1024 * 1024 && b.types.includes('audio/m4a'), JSON.stringify(b));
  b = await limit('portfolio-photos');
  check('portfolio allows short videos', b.types.includes('video/mp4') && Number(b.size) === 60 * 1024 * 1024, JSON.stringify(b));
  b = await limit('verification-docs');
  check('verification documents allow PDFs', b.types.includes('application/pdf'), JSON.stringify(b));
  check('every bucket now has a limit', (await one(`select count(*)::int as n from storage.buckets where file_size_limit is null`)).n === 0);

  console.log('\nF. signed-out lookups');
  r = await as('anon', `select public.phone_in_use('0241234567')`);
  check('signed out, the phone check is refused', !r.ok && /permission denied/i.test(r.error), r.ok ? 'it worked' : r.error);
  r = await as('anon', `select public.email_in_use('a@b.co')`);
  check('signed out, the email check is refused', !r.ok && /permission denied/i.test(r.error), r.ok ? 'it worked' : r.error);
  r = await as(ID.cust, `select public.phone_in_use('0241234567') as x`);
  check('signed in, it still works', r.ok, r.error);

  console.log('\nG. small leaks');
  const thread = (await one(`insert into public.chat_threads (request_id, provider_id, customer_id) values (gen_random_uuid(), '${ID.prov}', '${ID.cust}') returning id`)).id;
  await db.exec(`insert into public.chat_messages (thread_id, sender_id) values ('${thread}', '${ID.prov}')`);
  r = await as(ID.cust, `select public.count_unread_threads('${ID.cust}', 'customer') as n`);
  check('you can count your own unread chats', r.ok && r.rows[0].n === 1, r.error ?? JSON.stringify(r.rows));
  r = await as(ID.stranger, `select public.count_unread_threads('${ID.cust}', 'customer') as n`);
  check("you cannot count someone else's", r.ok && r.rows[0].n === 0, r.error ?? JSON.stringify(r.rows));
  await db.exec(`insert into public.user_blocks values ('${ID.cust}', '${ID.prov2}')`);
  r = await as(ID.cust, `select public.is_blocked_between('${ID.cust}', '${ID.prov2}') as b`);
  check('the two people involved can see a block', r.ok && r.rows[0].b === true, r.error);
  r = await as(ID.stranger, `select public.is_blocked_between('${ID.cust}', '${ID.prov2}') as b`);
  check('a stranger cannot tell whether two people blocked each other', r.ok && r.rows[0].b === false, r.error);
  const locReq = (await one(`insert into public.service_requests (customer_id, location_label) values ('${ID.cust}', 'Osu, Accra') returning id`)).id;
  await as(ID.stranger, `select public.set_request_location_from_label('${locReq}')`);
  check("a stranger cannot set another customer's request location", (await one(`select location from public.service_requests where id = '${locReq}'`)).location === null);
  await as(ID.cust, `select public.set_request_location_from_label('${locReq}')`);
  check('the owner can', (await one(`select location from public.service_requests where id = '${locReq}'`)).location === 'POINT(1 1)');

  console.log('\nH. customer ratings');
  const crow = await one(`select customer_rating::float as r, customer_reviews_count as n from public.profiles where id = '${ID.cust}'`);
  check('recomputed from real customer reviews (one 4-star)', crow.r === 4 && crow.n === 1 || crow.r === 0, JSON.stringify(crow));
  const newc = await one(`insert into public.profiles (id, role) values (gen_random_uuid(), 'customer') returning customer_rating::float as r`);
  check('a new customer starts at 0, not 4.8', newc.r === 0, JSON.stringify(newc));

  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
