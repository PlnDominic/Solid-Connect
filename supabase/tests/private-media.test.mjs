// Tests for migration 0089_private_media_and_suspension_columns.sql: who can
// read chat and request media once those buckets are private, and that the
// suspension reason is no longer public. Runs the real migration on PGlite
// over a reduced schema (storage.objects with row-level security).
//
//   node supabase/tests/private-media.test.mjs

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
const db = new PGlite();

const ID = {
  alice: '00000000-0000-0000-0000-00000000a001', // customer, chats with pat, has a request and a job post
  pat: '00000000-0000-0000-0000-00000000d004', // provider chatting with alice, can view her request
  quinn: '00000000-0000-0000-0000-00000000e005', // provider with no link to alice
  bob: '00000000-0000-0000-0000-00000000b002', // unrelated customer
  ada: '00000000-0000-0000-0000-00000000a008', // admin
  susp: '00000000-0000-0000-0000-00000000f006', // suspended user
  req: '00000000-0000-0000-0000-0000000000a1',
};

const PRELUDE = `
create role anon nologin;
create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

create schema storage;
create table storage.buckets (id text primary key, public boolean default false);
insert into storage.buckets values
  ('chat-photos', true), ('chat-audio', true), ('request-photos', true), ('profile-photos', true);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text not null, name text not null);
create function storage.foldername(name text) returns text[] language sql immutable
  as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select on storage.objects to anon, authenticated;

-- The public read policies the migration must remove, and one it must not touch.
create policy "chat photos are publicly readable" on storage.objects for select using (bucket_id = 'chat-photos');
create policy "anyone can read chat audio" on storage.objects for select using (bucket_id = 'chat-audio');
create policy "request photos are publicly readable" on storage.objects for select using (bucket_id = 'request-photos');
create policy "profile photos are publicly readable" on storage.objects for select using (bucket_id = 'profile-photos');

create table public.admins (id uuid primary key);
create function public.is_admin() returns boolean language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.admins where id = auth.uid()) $$;
create table public.profiles (id uuid primary key, full_name text, suspended_at timestamptz, suspended_reason text, suspended_by uuid);
-- As in 0073: no table-wide read; each column is granted on its own.
revoke select on public.profiles from anon, authenticated;
grant select (id, full_name, suspended_at, suspended_reason, suspended_by) on public.profiles to anon, authenticated;
create table public.chat_threads (id uuid primary key default gen_random_uuid(), customer_id uuid, provider_id uuid);
create table public.service_requests (id uuid primary key, customer_id uuid not null);
create table public.request_viewers (request_id uuid, user_id uuid);
create function public.can_view_request(p_request_id uuid) returns boolean language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.request_viewers v where v.request_id = p_request_id and v.user_id = auth.uid()) $$;
create table public.job_posts (id uuid primary key default gen_random_uuid(), customer_id uuid not null, status text not null default 'open');
create table public.job_post_interests (post_id uuid, provider_id uuid);
create function public.has_job_post_interest(p_post_id uuid) returns boolean language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.job_post_interests i where i.post_id = p_post_id and i.provider_id = auth.uid()) $$;
grant execute on function public.is_admin(), public.can_view_request(uuid), public.has_job_post_interest(uuid) to anon, authenticated;
grant select on public.chat_threads, public.service_requests, public.job_posts to authenticated;
`;

const FIXTURES = `
insert into public.admins values ('${ID.ada}');
insert into public.profiles (id, full_name, suspended_at, suspended_reason, suspended_by) values
  ('${ID.alice}', 'Alice', null, null, null), ('${ID.susp}', 'Sam', now(), 'Fake documents', '${ID.ada}');
insert into public.chat_threads (customer_id, provider_id) values ('${ID.alice}', '${ID.pat}');
insert into public.service_requests values ('${ID.req}', '${ID.alice}');
insert into public.request_viewers values ('${ID.req}', '${ID.pat}');
insert into storage.objects (bucket_id, name) values
  ('chat-photos', '${ID.alice}/a.jpg'), ('chat-photos', '${ID.pat}/p.jpg'),
  ('chat-audio', '${ID.alice}/a.m4a'),
  ('request-photos', '${ID.alice}/r.jpg'),
  ('profile-photos', '${ID.alice}/me.jpg');
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
const canRead = async (who, bucket, name) => {
  const r = await as(who, `select name from storage.objects where bucket_id = '${bucket}' and name = '${name}'`);
  return r.ok && r.rows.length === 1;
};

async function main() {
  await db.exec(PRELUDE);
  await db.exec(FIXTURES);
  const sql = readFileSync(join(here, '..', 'migrations', '0089_private_media_and_suspension_columns.sql'), 'utf8');
  await db.exec(sql);
  await db.exec(sql); // safe to re-run

  console.log('\nbuckets');
  const priv = (await db.query(`select id from storage.buckets where public = false order by id`)).rows.map((r) => r.id);
  check('chat photos, chat audio and request photos are private', ['chat-audio', 'chat-photos', 'request-photos'].every((b) => priv.includes(b)), priv.join(','));
  check('profile photos stay public', !priv.includes('profile-photos'));
  check('anyone can still read a profile photo', await canRead('anon', 'profile-photos', `${ID.alice}/me.jpg`));

  console.log('\nchat media');
  check('the sender can read their own photo', await canRead(ID.alice, 'chat-photos', `${ID.alice}/a.jpg`));
  check('the person they are chatting with can read it', await canRead(ID.pat, 'chat-photos', `${ID.alice}/a.jpg`));
  check('the reverse works too', await canRead(ID.alice, 'chat-photos', `${ID.pat}/p.jpg`));
  check('an unrelated provider cannot', !(await canRead(ID.quinn, 'chat-photos', `${ID.alice}/a.jpg`)));
  check('an unrelated customer cannot', !(await canRead(ID.bob, 'chat-photos', `${ID.alice}/a.jpg`)));
  check('a signed-out visitor cannot', !(await canRead('anon', 'chat-photos', `${ID.alice}/a.jpg`)));
  check('an admin can', await canRead(ID.ada, 'chat-photos', `${ID.alice}/a.jpg`));
  check('voice notes follow the same rule (partner can, stranger cannot)',
    (await canRead(ID.pat, 'chat-audio', `${ID.alice}/a.m4a`)) && !(await canRead(ID.quinn, 'chat-audio', `${ID.alice}/a.m4a`)));
  const listed = await as(ID.quinn, `select count(*)::int as n from storage.objects where bucket_id in ('chat-photos', 'chat-audio')`);
  check('a stranger cannot even list chat media', listed.ok && listed.rows[0].n === 0, JSON.stringify(listed));
  const anonList = await as('anon', `select count(*)::int as n from storage.objects where bucket_id in ('chat-photos', 'chat-audio', 'request-photos')`);
  check('a signed-out visitor cannot list private buckets', anonList.ok && anonList.rows[0].n === 0, JSON.stringify(anonList));

  console.log('\nrequest photos');
  check('the customer can read their own', await canRead(ID.alice, 'request-photos', `${ID.alice}/r.jpg`));
  check('a provider who can see the request can read its photo', await canRead(ID.pat, 'request-photos', `${ID.alice}/r.jpg`));
  check('a provider with no link to the request cannot', !(await canRead(ID.quinn, 'request-photos', `${ID.alice}/r.jpg`)));
  check('an admin can', await canRead(ID.ada, 'request-photos', `${ID.alice}/r.jpg`));
  check('a signed-out visitor cannot', !(await canRead('anon', 'request-photos', `${ID.alice}/r.jpg`)));
  const post = (await db.query(`insert into public.job_posts (customer_id, status) values ('${ID.alice}', 'open') returning id`)).rows[0].id;
  check('an open job post makes the customer\'s photos visible to signed-in providers', await canRead(ID.quinn, 'request-photos', `${ID.alice}/r.jpg`));
  await db.exec(`update public.job_posts set status = 'closed' where id = '${post}'`);
  check('once the post is closed they cannot see them again', !(await canRead(ID.quinn, 'request-photos', `${ID.alice}/r.jpg`)));
  await db.exec(`insert into public.job_post_interests values ('${post}', '${ID.quinn}')`);
  check('a provider who showed interest keeps access', await canRead(ID.quinn, 'request-photos', `${ID.alice}/r.jpg`));

  console.log('\nsuspension details');
  let r = await as(ID.alice, `select suspended_reason from public.profiles`);
  check('the reason is not readable by app users', !r.ok && /permission denied/i.test(r.error), r.ok ? 'it worked' : r.error);
  r = await as('anon', `select suspended_by from public.profiles`);
  check('nor who suspended them, even signed out', !r.ok && /permission denied/i.test(r.error), r.ok ? 'it worked' : r.error);
  r = await as(ID.alice, `select full_name, suspended_at from public.profiles`);
  check('the rest of the profile still is', r.ok && r.rows.length === 2, r.error);
  r = await as(ID.susp, `select * from public.my_suspension()`);
  check('a suspended person can read their own reason', r.ok && r.rows.length === 1 && r.rows[0].suspended_reason === 'Fake documents', r.error ?? JSON.stringify(r.rows));
  r = await as(ID.alice, `select * from public.my_suspension()`);
  check('everyone else gets nothing from it about anyone else', r.ok && r.rows.every((x) => x.suspended_reason === null), JSON.stringify(r.rows));
  r = await as('anon', `select * from public.my_suspension()`);
  check('signed out, the function is refused', !r.ok, r.ok ? 'it worked' : r.error);

  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
