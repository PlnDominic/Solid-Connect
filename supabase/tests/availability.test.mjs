// Tests for migration 0087_availability_rpcs.sql: a provider can manage their
// own availability from the app, and nobody else's. Runs the real migration on
// PGlite over a reduced schema.
//
//   node supabase/tests/availability.test.mjs

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
const db = new PGlite();

const ID = {
  pat: '00000000-0000-0000-0000-00000000d004', // provider
  quinn: '00000000-0000-0000-0000-00000000e005', // another provider
  alice: '00000000-0000-0000-0000-00000000a001', // customer
};

const PRELUDE = `
create role anon nologin;
create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

create table public.profiles (
  id uuid primary key,
  role text not null default 'customer',
  availability_mode text not null default 'SCHEDULE'
);
create table public.provider_availability (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone text not null default 'Africa/Accra',
  check (end_time > start_time),
  unique (provider_id, day_of_week, start_time, end_time)
);
create table public.synced (provider_id uuid);
create function public.sync_provider_opportunities(p_provider_id uuid) returns integer language plpgsql as
  $$ begin insert into public.synced values (p_provider_id); return 0; end $$;

-- The app roles can read these tables but not change profiles directly (0078).
grant select on public.profiles, public.provider_availability to anon, authenticated;
grant all on public.synced to authenticated;
insert into public.profiles (id, role) values
  ('${ID.pat}', 'provider'), ('${ID.quinn}', 'provider'), ('${ID.alice}', 'customer');
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
const one = async (sql) => (await db.query(sql)).rows[0];
const slots = (arr) => JSON.stringify(arr).replace(/'/g, "''");

async function main() {
  await db.exec(PRELUDE);
  const sql = readFileSync(join(here, '..', 'migrations', '0087_availability_rpcs.sql'), 'utf8');
  await db.exec(sql);
  await db.exec(sql); // safe to re-run

  console.log('\nset_my_availability_mode');
  let r = await as(ID.pat, `select public.set_my_availability_mode('AVAILABLE_NOW') as m`);
  check('a provider can go available now', r.ok && r.rows[0].m === 'AVAILABLE_NOW', r.error);
  check('it is saved on their profile', (await one(`select availability_mode as m from public.profiles where id = '${ID.pat}'`)).m === 'AVAILABLE_NOW');
  check('going available re-runs matching for them', (await one(`select count(*)::int as n from public.synced where provider_id = '${ID.pat}'`)).n === 1);
  r = await as(ID.pat, `select public.set_my_availability_mode('PAUSED')`);
  check('a provider can pause', r.ok, r.error);
  check('pausing does not re-run matching', (await one(`select count(*)::int as n from public.synced`)).n === 1);
  r = await as(ID.pat, `select public.set_my_availability_mode('ALWAYS')`);
  check('an unknown mode is refused', !r.ok && /INVALID_MODE/.test(r.error), r.error);
  r = await as(ID.alice, `select public.set_my_availability_mode('AVAILABLE_NOW')`);
  check('a customer cannot set availability', !r.ok && /NOT_A_PROVIDER/.test(r.error), r.error);
  r = await as('anon', `select public.set_my_availability_mode('AVAILABLE_NOW')`);
  check('a signed-out caller cannot', !r.ok, r.error);
  check("another provider's mode is untouched", (await one(`select availability_mode as m from public.profiles where id = '${ID.quinn}'`)).m === 'SCHEDULE');
  r = await as(ID.pat, `update public.profiles set availability_mode = 'AVAILABLE_NOW' where id = '${ID.pat}'`);
  check('the profile column still cannot be written directly', !r.ok && /permission denied/i.test(r.error), r.ok ? 'it worked' : r.error);

  console.log('\nreplace_my_weekly_availability');
  const week = slots([
    { dayOfWeek: 1, startTime: '08:00', endTime: '18:00' },
    { dayOfWeek: 2, startTime: '08:00', endTime: '18:00' },
    { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
  ]);
  r = await as(ID.pat, `select public.replace_my_weekly_availability('${week}'::jsonb)`);
  check('a provider can save weekly hours', r.ok, r.error);
  check('the hours are stored', (await one(`select count(*)::int as n from public.provider_availability where provider_id = '${ID.pat}'`)).n === 3);
  check('saving hours switches them to on schedule', (await one(`select availability_mode as m from public.profiles where id = '${ID.pat}'`)).m === 'SCHEDULE');
  r = await as(ID.pat, `select public.replace_my_weekly_availability('${slots([{ dayOfWeek: 5, startTime: '10:00', endTime: '12:00' }])}'::jsonb)`);
  const days = (await db.query(`select day_of_week from public.provider_availability where provider_id = '${ID.pat}'`)).rows.map((x) => x.day_of_week);
  check('saving again replaces the old hours', r.ok && days.length === 1 && days[0] === 5, JSON.stringify(days));
  r = await as(ID.pat, `select public.replace_my_weekly_availability('${slots([{ dayOfWeek: 6, startTime: '18:00', endTime: '08:00' }])}'::jsonb)`);
  check('hours that end before they start are refused', !r.ok && /INVALID_SLOTS/.test(r.error), r.error);
  r = await as(ID.pat, `select public.replace_my_weekly_availability('${slots([{ dayOfWeek: 9, startTime: '08:00', endTime: '09:00' }])}'::jsonb)`);
  check('a day outside 0 to 6 is refused', !r.ok && /INVALID_SLOTS/.test(r.error), r.error);
  check('a refused save leaves the old hours in place', (await one(`select count(*)::int as n from public.provider_availability where provider_id = '${ID.pat}'`)).n === 1);
  r = await as(ID.pat, `select public.replace_my_weekly_availability('{"a":1}'::jsonb)`);
  check('something that is not a list is refused', !r.ok && /INVALID_SLOTS/.test(r.error), r.error);
  const many = slots(Array.from({ length: 29 }, () => ({ dayOfWeek: 1, startTime: '08:00', endTime: '09:00' })));
  r = await as(ID.pat, `select public.replace_my_weekly_availability('${many}'::jsonb)`);
  check('more than 28 slots is refused', !r.ok && /TOO_MANY_SLOTS/.test(r.error), r.error);
  r = await as(ID.pat, `select public.replace_my_weekly_availability('[]'::jsonb)`);
  check('an empty list clears the hours', r.ok && (await one(`select count(*)::int as n from public.provider_availability where provider_id = '${ID.pat}'`)).n === 0, r.error);
  r = await as(ID.alice, `select public.replace_my_weekly_availability('${week}'::jsonb)`);
  check('a customer cannot save hours', !r.ok && /NOT_A_PROVIDER/.test(r.error), r.error);
  r = await as(ID.quinn, `select public.replace_my_weekly_availability('${week}'::jsonb)`);
  check("one provider's save does not touch another's hours", r.ok && (await one(`select count(*)::int as n from public.provider_availability where provider_id = '${ID.pat}'`)).n === 0);
  r = await as('anon', `select day_of_week from public.provider_availability`);
  check('hours stay readable so customers can see them', r.ok && r.rows.length === 3, r.error);

  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
