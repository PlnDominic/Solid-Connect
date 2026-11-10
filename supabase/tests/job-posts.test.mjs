// Tests for the job board access rules in migration 0082_job_posts.sql.
//
// Runs the REAL migration against PGlite on top of a reduced copy of the
// tables it depends on (profiles, categories, notifications) and checks what
// each signed-in user can and cannot do.
//
//   node supabase/tests/job-posts.test.mjs

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
  full_name text not null default ''
);
create table public.categories (id text primary key, name text not null);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  type text not null, title text not null, body text not null default '',
  data jsonb not null default '{}'::jsonb, read_at timestamptz, created_at timestamptz not null default now()
);
grant all on all tables in schema public to anon, authenticated, service_role;
`;

const FIXTURES = `
insert into public.profiles (id, role, full_name) values
  ('${ID.alice}', 'customer', 'Alice A'),
  ('${ID.bob}', 'customer', 'Bob B'),
  ('${ID.pat}', 'provider', 'Pat P'),
  ('${ID.quinn}', 'provider', 'Quinn Q'),
  ('${ID.ada}', 'customer', 'Ada Admin');
insert into public.admins (id) values ('${ID.ada}');
insert into public.categories (id, name) values ('plumbing', 'Plumbing');
`;

let failures = 0;
let passes = 0;

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
const blocked = (r) => !r.ok && /row-level security|violates check|permission denied/i.test(r.error);

async function main() {
  await db.exec(PRELUDE);
  await db.exec(FIXTURES);
  await db.exec(migration('0082_job_posts.sql'));
  // Must be safe to re-run.
  await db.exec(migration('0082_job_posts.sql'));

  console.log('\njob_posts - creating');
  let r = await as(
    ID.alice,
    `insert into public.job_posts (id, customer_id, category_id, category_label, title, description, budget_min, budget_max, location_label)
     values ('${ID.post}', '${ID.alice}', 'plumbing', 'Plumbing', 'Fix kitchen sink', 'The kitchen sink leaks under the cabinet.', 200, 400, 'Osu, Accra') returning id`,
  );
  check('customer can post a job', r.ok && r.count === 1, r.error);
  r = await as(
    ID.bob,
    `insert into public.job_posts (customer_id, category_label, title, description, location_label)
     values ('${ID.alice}', 'Plumbing', 'Fake post', 'Posting in somebody else name.', 'Osu')`,
  );
  check("cannot post a job as someone else", blocked(r), r.ok ? 'it worked' : r.error);
  r = await as(
    ID.bob,
    `insert into public.job_posts (customer_id, category_label, title, description, location_label, interest_count)
     values ('${ID.bob}', 'Plumbing', 'Inflated', 'Starts with a fake interest count.', 'Osu', 50)`,
  );
  check('cannot create a post with a fake interest count', blocked(r), r.ok ? 'it worked' : r.error);
  r = await as('anon', `insert into public.job_posts (customer_id, category_label, title, description, location_label) values ('${ID.alice}', 'x', 'xxxx', 'xxxxxxxxxxxx', 'x')`);
  check('signed-out caller cannot post', denied(r) || blocked(r), r.ok ? 'it worked' : r.error);

  console.log('\njob_posts - reading');
  r = await as(ID.pat, `select id from public.job_posts`);
  check('provider sees the open post', r.ok && r.count === 1, r.error);
  r = await as(ID.bob, `select id from public.job_posts`);
  check('another signed-in user sees the open post', r.ok && r.count === 1, r.error);
  r = await as('anon', `select id from public.job_posts`);
  check('signed-out caller sees nothing', denied(r) || (r.ok && r.count === 0), r.error);

  console.log('\njob_post_interests');
  r = await as(ID.pat, `insert into public.job_post_interests (post_id, provider_id, message, proposed_price) values ('${ID.post}', '${ID.pat}', 'I can come today.', 300) returning id`);
  check('provider can express interest', r.ok && r.count === 1, r.error);
  let row = (await db.query(`select interest_count from public.job_posts where id = '${ID.post}'`)).rows[0];
  check('interest_count goes up', row.interest_count === 1, JSON.stringify(row));
  row = (await db.query(`select count(*)::int as n from public.notifications where user_id = '${ID.alice}' and type = 'job_post_interest'`)).rows[0];
  check('customer gets a notification', row.n === 1, JSON.stringify(row));
  r = await as(ID.bob, `insert into public.job_post_interests (post_id, provider_id, message) values ('${ID.post}', '${ID.bob}', 'Me too')`);
  check('a customer account cannot express interest', blocked(r), r.ok ? 'it worked' : r.error);
  r = await as(ID.quinn, `insert into public.job_post_interests (post_id, provider_id, message) values ('${ID.post}', '${ID.pat}', 'As Pat')`);
  check('cannot express interest as another provider', blocked(r), r.ok ? 'it worked' : r.error);
  r = await as(ID.quinn, `insert into public.job_post_interests (post_id, provider_id, message) values ('${ID.post}', '${ID.quinn}', 'Available tomorrow.') returning id`);
  check('second provider can express interest', r.ok && r.count === 1, r.error);

  r = await as(ID.alice, `select provider_id from public.job_post_interests where post_id = '${ID.post}'`);
  check('customer sees everyone interested', r.ok && r.count === 2, r.error);
  r = await as(ID.pat, `select provider_id from public.job_post_interests where post_id = '${ID.post}'`);
  check("provider sees only their own interest, not a competitor's", r.ok && r.count === 1 && r.rows[0].provider_id === ID.pat, r.error);
  r = await as(ID.bob, `select provider_id from public.job_post_interests`);
  check('an unrelated user sees no interests', r.ok && r.count === 0, r.error);
  r = await as(ID.ada, `select provider_id from public.job_post_interests`);
  check('admin sees all interests', r.ok && r.count === 2, r.error);

  console.log('\nupdates');
  r = await as(ID.pat, `update public.job_post_interests set status = 'hired' where provider_id = '${ID.pat}'`);
  row = (await db.query(`select status from public.job_post_interests where provider_id = '${ID.pat}'`)).rows[0];
  check('provider cannot mark themselves hired', row.status === 'pending', JSON.stringify(row));
  r = await as(ID.pat, `update public.job_post_interests set message = 'Updated note' where provider_id = '${ID.pat}'`);
  row = (await db.query(`select message from public.job_post_interests where provider_id = '${ID.pat}'`)).rows[0];
  check('provider can edit their note', r.ok && row.message === 'Updated note', r.error ?? JSON.stringify(row));
  r = await as(ID.alice, `update public.job_post_interests set status = 'shortlisted', message = 'rewritten' where provider_id = '${ID.pat}'`);
  row = (await db.query(`select status, message from public.job_post_interests where provider_id = '${ID.pat}'`)).rows[0];
  check('customer can shortlist but not rewrite the note', r.ok && row.status === 'shortlisted' && row.message === 'Updated note', r.error ?? JSON.stringify(row));
  r = await as(ID.alice, `update public.job_posts set interest_count = 99, title = 'Fix kitchen sink today' where id = '${ID.post}'`);
  row = (await db.query(`select interest_count, title from public.job_posts where id = '${ID.post}'`)).rows[0];
  check('customer can edit the title but not the interest count', r.ok && row.interest_count === 2 && row.title === 'Fix kitchen sink today', r.error ?? JSON.stringify(row));
  r = await as(ID.bob, `update public.job_posts set status = 'closed' where id = '${ID.post}'`);
  row = (await db.query(`select status from public.job_posts where id = '${ID.post}'`)).rows[0];
  check("another user cannot close someone's post", row.status === 'open', JSON.stringify(row));

  console.log('\nclosing');
  r = await as(ID.quinn, `delete from public.job_post_interests where provider_id = '${ID.quinn}'`);
  row = (await db.query(`select interest_count from public.job_posts where id = '${ID.post}'`)).rows[0];
  check('withdrawing interest lowers the count', r.ok && row.interest_count === 1, r.error ?? JSON.stringify(row));
  r = await as(ID.alice, `update public.job_posts set status = 'hired', hired_provider_id = '${ID.pat}' where id = '${ID.post}'`);
  check('customer can mark the post hired', r.ok, r.error);
  r = await as(ID.quinn, `select id from public.job_posts`);
  check('a closed post leaves the board for other providers', r.ok && r.count === 0, r.error);
  r = await as(ID.pat, `select id from public.job_posts`);
  check('the interested provider can still read it', r.ok && r.count === 1, r.error);
  r = await as(ID.quinn, `insert into public.job_post_interests (post_id, provider_id, message) values ('${ID.post}', '${ID.quinn}', 'Late')`);
  check('cannot express interest in a closed post', blocked(r), r.ok ? 'it worked' : r.error);
  r = await as(ID.bob, `delete from public.job_posts where id = '${ID.post}'`);
  row = (await db.query(`select count(*)::int as n from public.job_posts`)).rows[0];
  check("another user cannot delete someone's post", row.n === 1, JSON.stringify(row));
  r = await as(ID.alice, `delete from public.job_posts where id = '${ID.post}'`);
  row = (await db.query(`select count(*)::int as n from public.job_posts`)).rows[0];
  check('customer can delete their post', r.ok && row.n === 0, r.error ?? JSON.stringify(row));

  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
