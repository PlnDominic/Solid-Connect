// Tests for migration 0092_push_and_expiry_in_database.sql. Runs the real
// migration on PGlite, with stand-ins for pg_net and pg_cron.
//
//   node supabase/tests/push-in-database.test.mjs

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
const db = new PGlite();

await db.exec(`
create role anon nologin;
create role authenticated nologin;
create schema extensions;
create table public.profiles (id uuid primary key, push_token text, notification_prefs jsonb not null default '{}');
create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null,
  type text not null, title text not null, body text not null, data jsonb);
create table public.push_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique references public.notifications(id),
  user_id uuid not null, status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'skipped', 'failed')),
  push_token text, ticket_id text, error text,
  created_at timestamptz not null default now(), sent_at timestamptz, receipt_checked_at timestamptz);
create table public.job_posts (id serial primary key, status text, expires_at timestamptz, expiry_notified_at timestamptz);

create schema net;
create table net.calls (id bigserial primary key, url text, body jsonb);
create table net._http_response (id bigint primary key, status_code int, content text);
create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
  headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint language sql
  as $$ insert into net.calls (url, body) values ($1, $2) returning id $$;

create schema cron;
create table cron.job (jobname text primary key, schedule text, command text);
create table cron.job_run_details (end_time timestamptz);
create function cron.schedule(text, text, text) returns bigint language sql
  as $$ insert into cron.job values ($1, $2, $3)
        on conflict (jobname) do update set schedule = $2, command = $3 returning 1::bigint $$;
`);

// The real preference mapping, from the migration that defines it.
const prefKey = readFileSync(join(here, '..', 'migrations', '0043_push_delivery.sql'), 'utf8')
  .match(/create or replace function public\.notification_pref_key[\s\S]*?\$\$;/)[0];
await db.exec(prefKey);

const migration = readFileSync(join(here, '..', 'migrations', '0092_push_and_expiry_in_database.sql'), 'utf8')
  .replace(/^create extension .*$/gm, '');

let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed += 1;
}
const rows = async (sql) => (await db.query(sql)).rows;
const uid = (n) => `00000000-0000-0000-0000-00000000000${n}`;

async function queue(user, type = 'job_accepted', data = null, age = '0 seconds') {
  const [n] = await rows(`insert into notifications (user_id, type, title, body, data)
    values ('${user}', '${type}', 'T', 'B', ${data ? `'${JSON.stringify(data)}'` : 'null'}) returning id`);
  const [o] = await rows(`insert into push_outbox (notification_id, user_id, created_at)
    values ('${n.id}', '${user}', now() - interval '${age}') returning id`);
  return o.id;
}
const row = async (id) => (await rows(`select * from push_outbox where id = '${id}'`))[0];
const drain = () => db.exec('select drain_push_outbox()');
const answer = (requestId, status, content) =>
  db.query('insert into net._http_response values ($1, $2, $3)', [requestId, status, content]);

await db.exec(`insert into profiles values
  ('${uid(1)}', 'ExponentPushToken[one]', '{}'),
  ('${uid(2)}', null, '{}'),
  ('${uid(3)}', 'ExponentPushToken[three]', '{"jobUpdates": false}'),
  ('${uid(4)}', 'ExponentPushToken[four]', '{}')`);
const backlog = await queue(uid(1), 'job_accepted', null, '3 days');
await db.exec(`insert into job_posts (status, expires_at) values
  ('open', now() - interval '10 days'), ('open', now() - interval '1 hour')`);

await db.exec(migration);
await db.exec(migration);

check('running it twice leaves three schedules', (await rows('select 1 from cron.job')).length === 3);
check('the old backlog is not sent', (await row(backlog)).error === 'EXPIRED');
const posts = await rows('select expiry_notified_at from job_posts order by id');
check('only long-expired posts are marked as told', posts[0].expiry_notified_at && !posts[1].expiry_notified_at);

const good = await queue(uid(1), 'job_accepted', { jobId: 'j1' });
const noToken = await queue(uid(2));
const prefOff = await queue(uid(3));
const promo = await queue(uid(1), 'ADMIN_BROADCAST');
const dead = await queue(uid(4));
await drain();

const calls = await rows('select * from net.calls order by id');
check('only the two deliverable messages are sent', calls.length === 2, JSON.stringify(calls));
check('the message opens the job', calls[0].body.data.url === 'solidconnect://jobs/j1');
check('no token is skipped', (await row(noToken)).error === 'NO_TOKEN');
check('a turned-off preference is skipped', (await row(prefOff)).error === 'PREF_OFF');
check('promotions are off by default', (await row(promo)).error === 'PREF_OFF');

await drain();
check('nothing is sent twice while waiting', (await rows('select 1 from net.calls')).length === 2);

await answer((await row(good)).request_id, 200, '{"data":{"status":"ok","id":"tick-1"}}');
await answer((await row(dead)).request_id, 200,
  '{"data":{"status":"error","message":"gone","details":{"error":"DeviceNotRegistered"}}}');
await drain();
check('an accepted message is marked sent', (await row(good)).status === 'sent' && (await row(good)).ticket_id === 'tick-1');
check('a dead device is marked failed', (await row(dead)).status === 'failed');
check('and its token is removed',
  (await rows(`select push_token from profiles where id = '${uid(4)}'`))[0].push_token === null);

const retry = await queue(uid(1));
for (let attempt = 0; attempt < 3; attempt += 1) {
  await drain();
  await answer((await row(retry)).request_id, 503, 'busy');
}
await drain();
check('a server error is retried three times, then fails',
  (await row(retry)).status === 'failed' && (await row(retry)).attempts === 3, JSON.stringify(await row(retry)));

const silent = await queue(uid(1));
await drain();
await db.exec(`update push_outbox set claimed_at = now() - interval '11 minutes' where id = '${silent}'`);
await drain();
check('no answer is not resent', (await row(silent)).error === 'NO_RESPONSE');

await db.exec(`update push_outbox set sent_at = now() - interval '20 minutes' where id = '${good}'`);
await drain();
const asked = await row(good);
check('a receipt is requested', !!asked.receipt_request_id);
await answer(asked.receipt_request_id, 200,
  '{"data":{"tick-1":{"status":"error","details":{"error":"DeviceNotRegistered"}}}}');
await drain();
check('the receipt is recorded', !!(await row(good)).receipt_checked_at && (await row(good)).error === 'DeviceNotRegistered');
check('a dead device found by receipt loses its token',
  (await rows(`select push_token from profiles where id = '${uid(1)}'`))[0].push_token === null);

const [{ allowed }] = await rows(`select has_function_privilege('authenticated', 'public.drain_push_outbox()', 'execute') as allowed`);
check('signed-in users cannot run the sender', allowed === false);

console.log(failed ? `\n${failed} failed` : '\nAll passed');
process.exit(failed ? 1 : 0);
