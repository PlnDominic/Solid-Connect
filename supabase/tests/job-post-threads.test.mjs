// Tests for chat before hire (migration 0090_job_post_threads.sql).
//
// Runs the REAL migration against PGlite on top of a reduced copy of the
// tables it depends on (profiles, categories, notifications) and checks what
// each signed-in user can and cannot do.
//
//   node supabase/tests/job-post-threads.test.mjs

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
const migration = (name) => readFileSync(join(here, '..', 'migrations', name), 'utf8');

const ID = {
  alice: '00000000-0000-0000-0000-00000000a001', // customer who posts
  bob: '00000000-0000-0000-0000-00000000b002', // another customer
  pat: '00000000-0000-0000-0000-00000000d004', // provider
  quinn: '00000000-0000-0000-0000-00000000e005', // provider
  rex: '00000000-0000-0000-0000-00000000f006', // provider with no interest in the post
  ada: '00000000-0000-0000-0000-00000000a008', // admin
  post: '00000000-0000-0000-0000-0000000000a1',
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
  role text not null default 'customer',
  full_name text not null default '',
  provider_category text,
  suspended_at timestamptz
);
create table public.provider_categories (
  provider_id uuid not null references public.profiles(id),
  category_id text not null,
  primary key (provider_id, category_id)
);
create table public.user_blocks (blocker_id uuid not null, blocked_id uuid not null);
create function public.is_blocked_between(p_a uuid, p_b uuid) returns boolean language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.user_blocks where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)) $$;
create table public.jobs (id uuid primary key default gen_random_uuid());
create table public.service_requests (id uuid primary key default gen_random_uuid(), customer_id uuid references public.profiles(id), status text not null default 'open');
create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id),
  reported_id uuid not null references public.profiles(id),
  context text not null default 'profile' check (context in ('profile', 'chat', 'job')),
  reason text not null default 'other'
);
create table public.categories (id text primary key, name text not null);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  type text not null, title text not null, body text not null default '',
  data jsonb not null default '{}'::jsonb, read_at timestamptz, created_at timestamptz not null default now()
);
create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.service_requests(id),
  job_id uuid references public.jobs(id),
  customer_id uuid not null references public.profiles(id),
  provider_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (request_id, provider_id)
);
alter table public.chat_threads enable row level security;
create policy "chat threads visible to their participants" on public.chat_threads
  for select using (auth.uid() = customer_id or auth.uid() = provider_id);
grant all on all tables in schema public to anon, authenticated, service_role;
`;

const FIXTURES = `
insert into public.profiles (id, role, full_name, provider_category) values
  ('${ID.alice}', 'customer', 'Alice A', null),
  ('${ID.bob}', 'customer', 'Bob B', null),
  ('${ID.pat}', 'provider', 'Pat P', 'Plumbing'),
  ('${ID.quinn}', 'provider', 'Quinn Q', 'Electrical'),
  ('${ID.rex}', 'provider', 'Rex R', 'Plumbing'),
  ('${ID.ada}', 'customer', 'Ada Admin', null);
insert into public.provider_categories (provider_id, category_id) values ('${ID.pat}', 'plumbing'), ('${ID.quinn}', 'electrical');
insert into public.admins (id) values ('${ID.ada}');
insert into public.categories (id, name) values ('plumbing', 'Plumbing'), ('electrical', 'Electrical');
`;

let failures = 0;
let passes = 0;

async function as(who, sql) {
  const role = who === 'anon' ? 'anon' : 'authenticated';
  const sub = who === 'anon' ? '' : who;
  await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.sub', '${sub}', false);`);
  try {
    const r = await db.query(sql);
    return { ok: true, rows: r.rows };
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

const open = (who, provider) => as(who, `select public.open_job_post_thread('${ID.post}', '${provider}') as id`);

async function main() {
  await db.exec(PRELUDE);
  await db.exec(FIXTURES);
  for (const f of ['0082_job_posts.sql', '0083_job_post_expiry_alerts_reports.sql', '0084_job_post_blocks_limits_notices.sql', '0090_job_post_threads.sql']) await db.exec(migration(f));
  await db.exec(migration('0090_job_post_threads.sql')); // safe to re-run

  await db.exec(`insert into public.job_posts (id, customer_id, category_id, category_label, title, description, location_label)
    values ('${ID.post}', '${ID.alice}', 'plumbing', 'Plumbing', 'Fix kitchen sink', 'The kitchen sink leaks under the cabinet.', 'Osu, Accra')`);
  await db.exec(`insert into public.job_post_interests (post_id, provider_id, message) values
    ('${ID.post}', '${ID.pat}', 'I can do this tomorrow morning.'), ('${ID.post}', '${ID.quinn}', 'Available this week.')`);

  console.log('open_job_post_thread');
  let r = await open(ID.alice, ID.pat);
  check('the customer can open a thread with an interested provider', r.ok && !!r.rows[0].id, r.error);
  const first = r.rows?.[0]?.id;
  r = await open(ID.pat, ID.pat);
  check('the provider gets the same thread back', r.ok && r.rows[0].id === first, r.error);
  r = await open(ID.alice, ID.pat);
  check('opening twice never makes a second thread', r.ok && r.rows[0].id === first, r.error);
  check('exactly one thread row exists', (await db.query(`select count(*)::int n from public.chat_threads where job_post_id = '${ID.post}' and provider_id = '${ID.pat}'`)).rows[0].n === 1);
  r = await open(ID.alice, ID.rex);
  check('cannot open a thread with a provider who is not on the post', !r.ok, r.ok ? 'it worked' : '');
  r = await open(ID.bob, ID.pat);
  check('another customer cannot open a thread on the post', !r.ok, r.ok ? 'it worked' : '');
  r = await open(ID.quinn, ID.pat);
  check('another provider cannot open someone elses thread', !r.ok, r.ok ? 'it worked' : '');
  r = await open('anon', ID.pat);
  check('signed-out caller cannot open a thread', !r.ok, r.ok ? 'it worked' : '');
  await db.exec(`update public.job_post_interests set status = 'declined' where post_id = '${ID.post}' and provider_id = '${ID.quinn}'`);
  r = await open(ID.alice, ID.quinn);
  check('no new thread for a declined provider', !r.ok, r.ok ? 'it worked' : '');
  r = await as(ID.alice, `select id from public.chat_threads where job_post_id = '${ID.post}'`);
  check('the customer can read the thread', r.ok && r.rows.length === 1, r.error);
  r = await as(ID.rex, `select id from public.chat_threads`);
  check('an outsider cannot read it', r.ok && r.rows.length === 0, r.error);

  console.log(`${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
