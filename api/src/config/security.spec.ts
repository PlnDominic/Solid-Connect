import {
  isProduction,
  parseTrustProxy,
  productionConfigProblems,
  resolveCorsOrigin,
  swaggerEnabled,
} from './security';

const goodProd = {
  NODE_ENV: 'production',
  SUPABASE_URL: 'https://abc.supabase.co',
  SUPABASE_SECRET_KEY: 'secret',
  SUPABASE_JWKS_URL: 'https://abc.supabase.co/auth/v1/.well-known/jwks.json',
  HUBTEL_CLIENT_ID: 'id',
  HUBTEL_CLIENT_SECRET: 'secret',
  HUBTEL_MERCHANT_ACCOUNT: '123',
  HUBTEL_CALLBACK_URL:
    'https://api.example.com/api/v1/payments/webhooks/hubtel',
};

describe('isProduction', () => {
  it('is true only for NODE_ENV=production', () => {
    expect(isProduction({ NODE_ENV: 'production' })).toBe(true);
    expect(isProduction({ NODE_ENV: 'development' })).toBe(false);
    expect(isProduction({})).toBe(false);
  });
});

describe('parseTrustProxy', () => {
  it('defaults to one proxy hop in production and off elsewhere', () => {
    expect(parseTrustProxy(undefined, true)).toBe(1);
    expect(parseTrustProxy('', true)).toBe(1);
    expect(parseTrustProxy(undefined, false)).toBe(false);
  });

  it('reads a hop count, false, or an address list', () => {
    expect(parseTrustProxy('2', true)).toBe(2);
    expect(parseTrustProxy('0', true)).toBe(0);
    expect(parseTrustProxy('false', true)).toBe(false);
    expect(parseTrustProxy('loopback, 10.0.0.0/8', true)).toBe(
      'loopback, 10.0.0.0/8',
    );
  });

  it('refuses to trust every forwarding header', () => {
    expect(() => parseTrustProxy('true', true)).toThrow(
      /trust any client-supplied/,
    );
  });
});

describe('resolveCorsOrigin', () => {
  it('uses the configured list', () => {
    expect(resolveCorsOrigin(['https://admin.example.com'], true)).toEqual([
      'https://admin.example.com',
    ]);
  });

  it('allows any browser origin only outside production', () => {
    expect(resolveCorsOrigin([], false)).toBe(true);
    expect(resolveCorsOrigin([], true)).toBe(false);
  });
});

describe('swaggerEnabled', () => {
  it('is on in development, off in production unless asked for', () => {
    expect(swaggerEnabled({ NODE_ENV: 'development' })).toBe(true);
    expect(swaggerEnabled({ NODE_ENV: 'production' })).toBe(false);
    expect(
      swaggerEnabled({ NODE_ENV: 'production', ENABLE_SWAGGER: 'true' }),
    ).toBe(true);
  });
});

describe('productionConfigProblems', () => {
  it('has nothing to say outside production', () => {
    expect(productionConfigProblems({ NODE_ENV: 'development' })).toEqual([]);
    expect(productionConfigProblems({})).toEqual([]);
  });

  it('accepts a complete production configuration', () => {
    expect(productionConfigProblems(goodProd)).toEqual([]);
  });

  it('reports missing Supabase settings', () => {
    const problems = productionConfigProblems({
      ...goodProd,
      SUPABASE_SECRET_KEY: '',
      SUPABASE_JWKS_URL: undefined,
    });
    expect(problems).toContain('SUPABASE_SECRET_KEY is required.');
    expect(problems).toContain('SUPABASE_JWKS_URL is required.');
  });

  it('requires https for Supabase and the Hubtel callback', () => {
    const problems = productionConfigProblems({
      ...goodProd,
      SUPABASE_URL: 'http://abc.supabase.co',
      HUBTEL_CALLBACK_URL: 'http://api.example.com/hook',
    });
    expect(problems).toContain('SUPABASE_URL must be an https:// URL.');
    expect(problems).toContain('HUBTEL_CALLBACK_URL must be an https:// URL.');
  });

  it('refuses to start without Hubtel unless simulated payments are explicitly allowed', () => {
    const noHubtel = {
      ...goodProd,
      HUBTEL_CLIENT_ID: '',
      HUBTEL_CLIENT_SECRET: '',
      HUBTEL_MERCHANT_ACCOUNT: '',
      HUBTEL_CALLBACK_URL: '',
    };
    expect(productionConfigProblems(noHubtel)).toHaveLength(4);
    expect(
      productionConfigProblems({
        ...noHubtel,
        ALLOW_SIMULATED_PAYMENTS: 'true',
      }),
    ).toEqual([]);
  });

  it('rejects a wildcard CORS origin', () => {
    expect(
      productionConfigProblems({
        ...goodProd,
        CORS_ORIGINS: 'https://a.com, *',
      }),
    ).toContain('CORS_ORIGINS must list real origins, not *.');
    expect(
      productionConfigProblems({ ...goodProd, CORS_ORIGINS: 'https://a.com' }),
    ).toEqual([]);
  });
});
