// Tests for migration 0086_real_ratings.sql: ratings come only from real,
// visible reviews. Runs the real migration on PGlite over a reduced schema.
//
//   node supabase/tests/real-ratings.test.mjs

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
const db = new PGlite();

const PRELUDE = `
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  role text not null default 'customer',
  full_name text not null default '',
  provider_rating numeric(2,1) not null default 4.8,
  provider_jobs_count int not null default 0
);
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id),
  rating int not null check (rating between 1 and 5),
  hidden_at timestamptz
);
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
const one = async (sql) => (await db.query(sql)).rows[0];

async function main() {
  await db.exec(PRELUDE);
  const mk = async (name, rating, count, role = 'provider') =>
    (await one(`insert into public.profiles (role, full_name, provider_rating, provider_jobs_count) values ('${role}', '${name}', ${rating}, ${count}) returning id`)).id;

  const unrated = await mk('Unrated', 4.8, 0);
  const demo = await mk('Demo', 4.9, 120); // made-up numbers, no reviews behind them
  const real = await mk('Real', 4.8, 0);
  const moderated = await mk('Moderated', 4.8, 2);
  const customer = await mk('Customer', 4.8, 0, 'customer');
  for (const r of [5, 4]) await db.exec(`insert into public.reviews (provider_id, rating) values ('${real}', ${r})`);
  await db.exec(`insert into public.reviews (provider_id, rating) values ('${moderated}', 5)`);
  await db.exec(`insert into public.reviews (provider_id, rating, hidden_at) values ('${moderated}', 1, now())`);

  const sql = readFileSync(join(here, '..', 'migrations', '0086_real_ratings.sql'), 'utf8');
  await db.exec(sql);
  await db.exec(sql); // safe to re-run

  console.log('\nreal ratings');
  const get = (id) => one(`select provider_rating::float as r, provider_jobs_count as n from public.profiles where id = '${id}'`);
  let row = await get(unrated);
  check('a provider with no reviews goes to 0 / 0', row.r === 0 && row.n === 0, JSON.stringify(row));
  row = await get(demo);
  check('made-up ratings and job counts are wiped', row.r === 0 && row.n === 0, JSON.stringify(row));
  row = await get(real);
  check('real reviews are averaged (5 and 4 give 4.5, 2 reviews)', row.r === 4.5 && row.n === 2, JSON.stringify(row));
  row = await get(moderated);
  check('a hidden review does not count', row.r === 5 && row.n === 1, JSON.stringify(row));
  row = await get(customer);
  check('customers are left alone', row.r === 4.8, JSON.stringify(row));

  const created = await one(`insert into public.profiles (role) values ('provider') returning provider_rating::float as r`);
  check('a new profile starts at 0, not 4.8', created.r === 0, JSON.stringify(created));

  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
