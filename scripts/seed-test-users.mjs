/**
 * Creates loginable Supabase Auth test users + rich provider profiles.
 * Usage: node scripts/seed-test-users.mjs
 * Requires SUPABASE_URL + SUPABASE_SECRET_KEY (or SERVICE_ROLE) in api/.env or root .env
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  for (const p of [resolve(root, 'api/.env'), resolve(root, '.env')]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

loadEnv();

const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or secret key');
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = 'SolidTest123!';

/** @type {const} */
const USERS = [
  {
    email: 'efua.customer@solidconnect.test',
    password: PASSWORD,
    role: 'customer',
    full_name: 'Efua Mensah',
    phone: '+233201000001',
    area: 'Achimota, Accra',
    tagline: null,
  },
  {
    email: 'kojo.customer@solidconnect.test',
    password: PASSWORD,
    role: 'customer',
    full_name: 'Kojo Owusu',
    phone: '+233201000002',
    area: 'Trasacco Valley, Accra',
    tagline: null,
  },
  {
    email: 'kwesi.plumber@solidconnect.test',
    password: PASSWORD,
    role: 'provider',
    full_name: 'Kwesi Amankwah',
    phone: '+233201000011',
    area: 'Achimota, Accra',
    tagline: 'Licensed plumber — leaks, heaters, and bathroom fittings',
    provider_category: 'Plumbing',
    category_id: 'plumbing',
    provider_rating: 4.8,
    provider_jobs_count: 126,
    provider_verified: true,
    provider_certified: false,
    verification_level: 'IDENTITY_VERIFIED',
    availability_mode: 'AVAILABLE_NOW',
    cities: ['Achimota', 'Airport Residential', 'Dansoman'],
    radius_km: 10,
    hub: 'Achimota',
    skill_names: ['Plumbing · General'],
    years: 8,
  },
  {
    email: 'ama.plumber@solidconnect.test',
    password: PASSWORD,
    role: 'provider',
    full_name: 'Ama Boateng',
    phone: '+233201000012',
    area: 'Achimota, Accra',
    tagline: 'Solid Connect certified — fast response plumbing',
    provider_category: 'Plumbing',
    category_id: 'plumbing',
    provider_rating: 4.9,
    provider_jobs_count: 212,
    provider_verified: true,
    provider_certified: true,
    verification_level: 'SOLID_CONNECT_VERIFIED',
    availability_mode: 'SCHEDULE',
    cities: ['Achimota', 'Osu', 'Cantonments', 'Spintex'],
    radius_km: 15,
    hub: 'Achimota',
    skill_names: ['Plumbing · General'],
    years: 12,
  },
  {
    email: 'yaw.electric@solidconnect.test',
    password: PASSWORD,
    role: 'provider',
    full_name: 'Yaw Osei',
    phone: '+233201000013',
    area: 'Airport Residential, Accra',
    tagline: 'House wiring, sockets, and lighting upgrades',
    provider_category: 'Electrical',
    category_id: 'electrical',
    provider_rating: 4.7,
    provider_jobs_count: 89,
    provider_verified: true,
    provider_certified: false,
    verification_level: 'IDENTITY_VERIFIED',
    availability_mode: 'AVAILABLE_NOW',
    cities: ['Airport Residential', 'Cantonments', 'Osu'],
    radius_km: 10,
    hub: 'Airport Residential',
    skill_names: ['Electrical · General'],
    years: 6,
  },
  {
    email: 'akoa.paint@solidconnect.test',
    password: PASSWORD,
    role: 'provider',
    full_name: 'Akoa Adjei',
    phone: '+233201000014',
    area: 'Osu, Accra',
    tagline: 'Interior & exterior painting — clean lines, fair quotes',
    provider_category: 'Painting',
    category_id: 'painting',
    provider_rating: 4.6,
    provider_jobs_count: 54,
    provider_verified: true,
    provider_certified: false,
    verification_level: 'PROFESSION_VERIFIED',
    availability_mode: 'SCHEDULE',
    cities: ['Osu', 'Cantonments', 'Airport Residential'],
    radius_km: 8,
    hub: 'Osu',
    skill_names: ['Painting · General'],
    years: 5,
  },
  {
    email: 'dual.user@solidconnect.test',
    password: PASSWORD,
    role: 'customer', // active mode; also gets PROVIDER
    also_provider: true,
    full_name: 'Nana Dual',
    phone: '+233201000020',
    area: 'Spintex, Accra',
    tagline: 'Weekend AC servicing when in provider mode',
    provider_category: 'AC repair',
    category_id: 'ac_repair',
    provider_rating: 4.5,
    provider_jobs_count: 18,
    provider_verified: true,
    provider_certified: false,
    verification_level: 'IDENTITY_VERIFIED',
    availability_mode: 'SCHEDULE',
    cities: ['Spintex', 'Tema'],
    radius_km: 12,
    hub: 'Spintex',
    skill_names: ['AC repair · General'],
    years: 3,
  },
];

const COORDS = {
  Achimota: { lng: -0.232, lat: 5.627 },
  'Trasacco Valley': { lng: -0.158, lat: 5.635 },
  'Airport Residential': { lng: -0.177, lat: 5.605 },
  Cantonments: { lng: -0.173, lat: 5.575 },
  Osu: { lng: -0.183, lat: 5.558 },
  Spintex: { lng: -0.098, lat: 5.636 },
  Tema: { lng: -0.017, lat: 5.669 },
  Dansoman: { lng: -0.266, lat: 5.548 },
};

function initials(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

async function findOrCreateAuthUser(u) {
  const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = listed?.users?.find((x) => x.email?.toLowerCase() === u.email.toLowerCase());
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name, seed: true },
    });
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: { full_name: u.full_name, seed: true },
  });
  if (error) throw error;
  return data.user.id;
}

async function upsertProfile(id, u) {
  const isProvider = u.role === 'provider' || u.also_provider;
  const row = {
    id,
    role: u.role,
    full_name: u.full_name,
    initials: initials(u.full_name),
    area: u.area,
    phone: u.phone,
    email: u.email,
    is_seed: true,
    photo_url: null,
    tagline: u.tagline,
    provider_category: isProvider ? u.provider_category : null,
    provider_rating: isProvider ? u.provider_rating ?? 0 : 0,
    provider_jobs_count: isProvider ? u.provider_jobs_count ?? 0 : 0,
    provider_distance_km: isProvider ? 2.5 : null,
    provider_verified: isProvider ? !!u.provider_verified : false,
    provider_certified: isProvider ? !!u.provider_certified : false,
    verification_level: isProvider ? u.verification_level ?? 'REGISTERED' : 'REGISTERED',
    availability_mode: isProvider ? u.availability_mode ?? 'SCHEDULE' : 'SCHEDULE',
  };
  const { error } = await admin.from('profiles').upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

async function syncAppUser(id, u) {
  // Prefer Nest-style tables when present
  const { data: existing } = await admin.from('users').select('id').eq('auth_user_id', id).maybeSingle();
  let userId = existing?.id;
  if (!userId) {
    const parts = u.full_name.split(/\s+/);
    const { data, error } = await admin
      .from('users')
      .insert({
        auth_user_id: id,
        email: u.email,
        phone: u.phone,
        first_name: parts[0] ?? null,
        last_name: parts.slice(1).join(' ') || null,
        status: 'ACTIVE',
      })
      .select('id')
      .single();
    if (error) throw error;
    userId = data.id;
  }

  const { data: roles } = await admin.from('roles').select('id, code');
  const byCode = Object.fromEntries((roles ?? []).map((r) => [r.code, r.id]));
  const want = ['CUSTOMER'];
  if (u.role === 'provider' || u.also_provider) want.push('PROVIDER');
  for (const code of want) {
    if (!byCode[code]) continue;
    await admin.from('user_roles').upsert(
      { user_id: userId, role_id: byCode[code] },
      { onConflict: 'user_id,role_id' },
    );
  }
}

async function attachProviderExtras(id, u) {
  if (!(u.role === 'provider' || u.also_provider)) return;

  const { data: skills } = await admin.from('skills').select('id, name');
  const skillIds = (skills ?? [])
    .filter((s) => (u.skill_names ?? []).includes(s.name))
    .map((s) => s.id);

  if (skillIds.length) {
    await admin.from('provider_skills').delete().eq('provider_id', id);
    await admin.from('provider_skills').insert(
      skillIds.map((skill_id) => ({
        provider_id: id,
        skill_id,
        years_experience: u.years ?? 1,
        verification_status: u.provider_verified ? 'VERIFIED' : 'UNVERIFIED',
      })),
    );
  }

  const areas = [];
  for (const city of u.cities ?? []) {
    areas.push({ type: 'CITY', cityName: city });
  }
  const hub = u.hub && COORDS[u.hub] ? COORDS[u.hub] : null;
  if (hub && u.radius_km) {
    areas.push({
      type: 'RADIUS',
      lng: hub.lng,
      lat: hub.lat,
      radiusMeters: u.radius_km * 1000,
    });
  }
  if (areas.length) {
    const { error } = await admin.rpc('replace_provider_service_areas', {
      p_provider_id: id,
      p_areas: areas,
    });
    if (error) console.warn('service areas:', error.message);
  }

  // Weekday schedule Mon–Fri 08:00–18:00
  await admin.from('provider_availability').delete().eq('provider_id', id);
  await admin.from('provider_availability').insert(
    [1, 2, 3, 4, 5].map((day_of_week) => ({
      provider_id: id,
      day_of_week,
      start_time: '08:00',
      end_time: '18:00',
      timezone: 'Africa/Accra',
    })),
  );
}

const created = [];

for (const u of USERS) {
  process.stdout.write(`Seeding ${u.email}… `);
  const id = await findOrCreateAuthUser(u);
  await upsertProfile(id, u);
  try {
    await syncAppUser(id, u);
  } catch (e) {
    console.warn('(users/roles skipped:', e.message + ')');
  }
  try {
    await attachProviderExtras(id, u);
  } catch (e) {
    console.warn('(provider extras:', e.message + ')');
  }
  created.push({ ...u, id });
  console.log('ok');
}

console.log('\n=== TEST CREDENTIALS (password for all: SolidTest123!) ===\n');
for (const u of created) {
  const kind =
    u.also_provider ? 'customer+provider' : u.role === 'provider' ? 'provider' : 'customer';
  console.log(`${u.full_name} <${u.email}>`);
  console.log(`  role: ${kind}`);
  console.log(`  phone: ${u.phone}`);
  if (u.provider_category) {
    console.log(`  trade: ${u.provider_category}`);
    console.log(`  area: ${u.area}`);
    console.log(`  cities: ${(u.cities ?? []).join(', ')}`);
    console.log(`  radius: ${u.radius_km} km from ${u.hub}`);
    console.log(`  verification: ${u.verification_level}`);
    console.log(`  availability: ${u.availability_mode}`);
    console.log(`  rating/jobs: ${u.provider_rating} / ${u.provider_jobs_count}`);
  }
  console.log(`  id: ${u.id}`);
  console.log('');
}
