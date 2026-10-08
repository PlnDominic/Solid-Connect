// Production-safety rules for starting the API. Kept as plain functions so
// they are easy to test and main.ts stays short.

export type Env = Record<string, string | undefined>;

export function isProduction(env: Env): boolean {
  return (env.NODE_ENV ?? 'development') === 'production';
}

/**
 * Express `trust proxy` setting. Behind a load balancer the client's address
 * only arrives in X-Forwarded-For; without this the rate limiter sees every
 * user as the load balancer's own IP and throttles them all together. Too
 * permissive a value lets a client spoof the header and dodge the limiter.
 *
 *   unset       production: 1 (one proxy, e.g. Render/Railway/Fly); otherwise off
 *   a number    that many proxy hops
 *   other text  passed straight to Express ("loopback", a subnet list ...)
 * `true` (trust everyone) is refused.
 */
export function parseTrustProxy(
  raw: string | undefined,
  production: boolean,
): boolean | number | string {
  const value = (raw ?? '').trim();
  if (!value) return production ? 1 : false;
  if (value === 'false') return false;
  if (value === 'true') {
    throw new Error(
      'TRUST_PROXY=true would trust any client-supplied forwarding header. Use a hop count (e.g. 1) or the proxy addresses.',
    );
  }
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

/**
 * Browsers are only allowed from the listed origins. Native apps don't use
 * CORS, so in production an empty list means "no browser origin is allowed"
 * (not "reflect whatever origin asks"); in development it stays open for
 * Expo web and local tools.
 */
export function resolveCorsOrigin(
  origins: string[],
  production: boolean,
): string[] | boolean {
  if (origins.length) return origins;
  return !production;
}

/** The interactive API docs list every route; off in production unless asked for. */
export function swaggerEnabled(env: Env): boolean {
  return !isProduction(env) || env.ENABLE_SWAGGER === 'true';
}

const has = (env: Env, key: string) => Boolean((env[key] ?? '').trim());

/**
 * What is wrong with this configuration for a production start. Empty means
 * fine (and always empty outside production).
 *
 * Payments matter most: without Hubtel the API falls back to releasing money
 * on confirmation with nothing charged, so a half-configured production
 * deploy would run jobs for free. Running that way on purpose (a staging
 * environment) needs ALLOW_SIMULATED_PAYMENTS=true.
 */
export function productionConfigProblems(env: Env): string[] {
  if (!isProduction(env)) return [];
  const problems: string[] = [];

  for (const key of [
    'SUPABASE_URL',
    'SUPABASE_SECRET_KEY',
    'SUPABASE_JWKS_URL',
  ]) {
    if (!has(env, key)) problems.push(`${key} is required.`);
  }
  if (
    has(env, 'SUPABASE_URL') &&
    !(env.SUPABASE_URL as string).trim().startsWith('https://')
  ) {
    problems.push('SUPABASE_URL must be an https:// URL.');
  }

  const origins = (env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (origins.includes('*'))
    problems.push('CORS_ORIGINS must list real origins, not *.');

  if (env.ALLOW_SIMULATED_PAYMENTS !== 'true') {
    for (const key of [
      'HUBTEL_CLIENT_ID',
      'HUBTEL_CLIENT_SECRET',
      'HUBTEL_MERCHANT_ACCOUNT',
      'HUBTEL_CALLBACK_URL',
    ]) {
      if (!has(env, key)) {
        problems.push(
          `${key} is required (or set ALLOW_SIMULATED_PAYMENTS=true to run without real payments).`,
        );
      }
    }
    if (
      has(env, 'HUBTEL_CALLBACK_URL') &&
      !(env.HUBTEL_CALLBACK_URL as string).trim().startsWith('https://')
    ) {
      problems.push('HUBTEL_CALLBACK_URL must be an https:// URL.');
    }
  }
  return problems;
}
