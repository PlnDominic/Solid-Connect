// Tests for migration 0085_no_platform_payments.sql.
//
// Runs the REAL migration on PGlite over a reduced copy of the tables the job
// functions touch, and checks that accepting, confirming and cancelling a job
// never create, require or change a payment, and that the old deposit and
// dispute-hold triggers are gone.
//
//   node supabase/tests/no-payments.test.mjs

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
const migration = (name) => readFileSync(join(here, '..', 'migrations', name), 'utf8');

const ID = {
  cust: '00000000-0000-0000-0000-00000000a001',
  prov: '00000000-0000-0000-0000-00000000d004',
  other: '00000000-0000-0000-0000-00000000b002',
};

const db = new PGlite();

const PRELUDE = `
create schema auth;
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable
  as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated') $$;

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null, category_label text not null default 'Plumbing', location_label text not null default 'Osu',
  status text not null default 'quoted', request_mode text not null default 'GENERAL',
  preferred_provider_id uuid, customer_budget int, budget_min int, budget_max int
);
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null, provider_id uuid not null, price int not null,
  eta_label text, badge_label text, badge_kind text, status text not null default 'sent',
  note text, revision int, updated_at timestamptz not null default now()
);
create table public.request_opportunities (request_id uuid, provider_id uuid, status text);
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null, quote_id uuid not null, customer_id uuid not null, provider_id uuid not null,
  title text not null default '', price int not null, location_label text not null default '',
  step int not null default 1, status text not null default 'accepted',
  started_at timestamptz not null default now(), completed_at timestamptz,
  provider_completed_at timestamptz, customer_confirmed_at timestamptz, scheduled_for timestamptz,
  cancelled_at timestamptz, cancelled_by uuid, cancel_reason text, cancel_note text
);
create table public.chat_threads (
  request_id uuid, provider_id uuid, customer_id uuid, job_id uuid, unique (request_id, provider_id)
);
create table public.job_events (job_id uuid, actor_id uuid, event_type text, from_step int, to_step int, note text);
create table public.notifications (user_id uuid, type text, title text, body text, data jsonb, created_at timestamptz not null default now());
create table public.disputes (id uuid primary key default gen_random_uuid(), job_id uuid, status text not null default 'open');
create table public.job_locations (job_id uuid);
create table public.job_reschedules (job_id uuid, status text, responded_at timestamptz);

-- The old payment objects the migration must neutralise.
create table public.payments (id uuid primary key default gen_random_uuid(), job_id uuid, amount int, deposit_amount int default 0, status text default 'pending');
create function public.noop() returns trigger language plpgsql as $$ begin return new; end $$;
create trigger jobs_require_deposit before update on public.jobs for each row execute function public.noop();
create trigger payments_set_deposit before insert on public.payments for each row execute function public.noop();
create trigger payments_block_release_during_dispute before update on public.payments for each row execute function public.noop();
create function public.report_unpaid_balance(p_job_id uuid, p_note text default '') returns void language sql as $$ select $$;
create function public.strip_contact_details_from_message() returns text language sql as $fn$ select '[Account details removed - all payments go through Solid Connect]'::text $fn$;
`;

let failures = 0;
let passes = 0;
function check(name, condition, detail = '') {
  if (condition) {
    passes += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`);
  }
}

async function as(user, sql, role = 'authenticated') {
  await db.exec(`select set_config('request.jwt.claim.sub', '${user}', false), set_config('request.jwt.claim.role', '${role}', false)`);
  try {
    const r = await db.query(sql);
    return { ok: true, rows: r.rows };
  } catch (e) {
    return { ok: false, error: String(e.message ?? e) };
  }
}
const one = async (sql) => (await db.query(sql)).rows[0];

async function newRequestAndQuote() {
  const req = (await one(`insert into public.service_requests (customer_id, category_label) values ('${ID.cust}', 'Home · Plumbing') returning id`)).id;
  const q = (await one(`insert into public.quotes (request_id, provider_id, price) values ('${req}', '${ID.prov}', 300) returning id`)).id;
  return { req, q };
}

async function main() {
  await db.exec(PRELUDE);
  await db.exec(migration('0085_no_platform_payments.sql'));
  // Safe to re-run.
  await db.exec(migration('0085_no_platform_payments.sql'));

  console.log('\ntriggers and helpers');
  const trig = (await one(`select count(*)::int as n from pg_trigger where tgname in ('jobs_require_deposit', 'payments_set_deposit', 'payments_block_release_during_dispute')`)).n;
  check('deposit and dispute-hold triggers are gone', trig === 0, `${trig} left`);
  const fn = (await one(`select count(*)::int as n from pg_proc where proname = 'report_unpaid_balance'`)).n;
  check('report_unpaid_balance is gone', fn === 0);
  const def = (await one(`select pg_get_functiondef('public.strip_contact_details_from_message()'::regprocedure) as d`)).d;
  check('chat placeholder no longer says payments go through Solid Connect', !def.includes('all payments go through') && def.includes('Account details removed'));

  console.log('\naccept_quote');
  const { req, q } = await newRequestAndQuote();
  let r = await as(ID.cust, `select public.accept_quote('${q}', '${ID.cust}') as res`);
  check('customer can accept a quote', r.ok, r.error);
  const job = await one(`select * from public.jobs where quote_id = '${q}'`);
  check('a job is created for the quote', !!job && job.status === 'accepted' && job.price === 300);
  check('no payment row is created', (await one(`select count(*)::int as n from public.payments`)).n === 0);
  check('a chat thread is created', (await one(`select count(*)::int as n from public.chat_threads where job_id = '${job.id}'`)).n === 1);
  r = await as(ID.other, `select public.accept_quote('${q}', '${ID.cust}')`);
  check("another user cannot accept someone else's quote", !r.ok && /FORBIDDEN/.test(r.error), r.error);

  console.log('\nconfirm_job_completion');
  r = await as(ID.cust, `select public.confirm_job_completion('${job.id}', '${ID.cust}')`);
  check('cannot confirm before the provider has finished', !r.ok && /JOB_NOT_READY/.test(r.error), r.error);
  await db.exec(`update public.jobs set status = 'awaiting_completion_confirmation', step = 4, provider_completed_at = now() where id = '${job.id}'`);
  await db.exec(`insert into public.disputes (job_id) values ('${job.id}')`);
  r = await as(ID.cust, `select public.confirm_job_completion('${job.id}', '${ID.cust}')`);
  check('an open dispute blocks confirmation', !r.ok && /JOB_DISPUTED/.test(r.error), r.error);
  await db.exec(`update public.disputes set status = 'resolved' where job_id = '${job.id}'`);
  r = await as(ID.cust, `select public.confirm_job_completion('${job.id}', '${ID.cust}') as res`);
  check('customer can confirm once the provider has finished', r.ok, r.error);
  check('the result carries the job and no payment', r.ok && r.rows[0].res.job?.status === 'completed' && !('payment' in r.rows[0].res));
  const done = await one(`select status, customer_confirmed_at from public.jobs where id = '${job.id}'`);
  check('the job is completed and confirmed', done.status === 'completed' && !!done.customer_confirmed_at);
  const note = await one(`select body from public.notifications where user_id = '${ID.prov}' and type = 'JOB_COMPLETED'`);
  check('the provider is told, without mentioning payment', !!note && !/payment|paid/i.test(note.body), note?.body);
  r = await as(ID.cust, `select public.confirm_job_completion('${job.id}', '${ID.cust}') as res`);
  check('confirming twice is harmless', r.ok, r.error);
  check('still no payment rows', (await one(`select count(*)::int as n from public.payments`)).n === 0);

  console.log('\ncancel_job');
  const second = await newRequestAndQuote();
  await as(ID.cust, `select public.accept_quote('${second.q}', '${ID.cust}')`);
  const job2 = await one(`select id from public.jobs where quote_id = '${second.q}'`);
  r = await as(ID.cust, `select public.cancel_job('${job2.id}', 'changed_mind', 'Plans changed') as res`);
  check('customer can cancel an accepted job', r.ok, r.error);
  const c = await one(`select status, cancel_reason from public.jobs where id = '${job2.id}'`);
  check('the job is cancelled with its reason', c.status === 'cancelled' && c.cancel_reason === 'changed_mind');
  check("the request is cancelled too", (await one(`select status from public.service_requests where id = '${second.req}'`)).status === 'cancelled');
  const cn = await one(`select body from public.notifications where user_id = '${ID.prov}' and type = 'JOB_CANCELLED'`);
  check('the provider is told it was cancelled', !!cn);
  check('cancelling creates no payment, payout or refund', (await one(`select count(*)::int as n from public.payments`)).n === 0);
  r = await as(ID.other, `select public.cancel_job('${job2.id}', 'other')`);
  check('a stranger cannot cancel a job', !r.ok && /FORBIDDEN/.test(r.error), r.error);

  console.log('\naccept_direct_request');
  const dreq = (await one(`insert into public.service_requests (customer_id, status, request_mode, preferred_provider_id, customer_budget, category_label) values ('${ID.cust}', 'awaiting_provider', 'DIRECT', '${ID.prov}', 450, 'Home · Electrical') returning id`)).id;
  r = await as(ID.prov, `select public.accept_direct_request('${dreq}', '${ID.prov}') as res`);
  check('provider can accept a direct request', r.ok, r.error);
  const djob = await one(`select id, price, status from public.jobs where request_id = '${dreq}'`);
  check('a job is created at the customer budget', !!djob && djob.price === 450 && djob.status === 'accepted');
  const dn = await one(`select title, body from public.notifications where user_id = '${ID.cust}' and type = 'DIRECT_ACCEPTED'`);
  check('the customer is told, with no deposit to pay', !!dn && dn.title === 'Provider accepted your request' && !/deposit/i.test(dn.body), dn?.body);
  check('no payment row for the direct job either', (await one(`select count(*)::int as n from public.payments`)).n === 0);

  console.log('\nreminders');
  await db.exec(`insert into public.jobs (request_id, quote_id, customer_id, provider_id, title, price, status, provider_completed_at)
                 values ('${dreq}', '${second.q}', '${ID.cust}', '${ID.prov}', 'Old job', 100, 'awaiting_completion_confirmation', now() - interval '30 hours')`);
  await db.exec(`select public.send_balance_reminders()`);
  const rem = await one(`select title, body from public.notifications where type = 'BALANCE_REMINDER'`);
  check('a finished job gets a confirm reminder that does not mention paying', !!rem && rem.title === 'Confirm your job' && !/pay|balance/i.test(rem.body), rem?.body);
  await db.exec(`select public.send_balance_reminders()`);
  check('the reminder is not repeated straight away', (await one(`select count(*)::int as n from public.notifications where type = 'BALANCE_REMINDER'`)).n === 1);

  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
