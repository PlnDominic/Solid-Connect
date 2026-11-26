// Tests for migration 0093_minimum_app_version.sql.
//
//   node supabase/tests/min-app-version.test.mjs

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create table public.platform_config (id boolean primary key);
  insert into public.platform_config values (true);
  alter table public.platform_config enable row level security;
  grant usage on schema public to anon;
`);
const migration = readFileSync(join(here, '..', 'migrations', '0093_minimum_app_version.sql'), 'utf8');
await db.exec(migration);
await db.exec(migration);

let failed = 0;
function check(name, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed += 1;
}

await db.exec(`update public.platform_config set min_app_version = '1.1.0'`);
await db.exec('set role anon');
check('someone not signed in can read the minimum',
  (await db.query('select public.min_app_version() as v')).rows[0].v === '1.1.0');
await db.exec('reset role');
const refused = await db.exec(`update public.platform_config set min_app_version = 'v2'`).then(() => false, () => true);
check('a badly written version is refused', refused);

console.log(failed ? `\n${failed} failed` : '\nAll passed');
process.exit(failed ? 1 : 0);
