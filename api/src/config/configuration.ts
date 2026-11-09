export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  supabase: {
    url: process.env.SUPABASE_URL ?? '',
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? '',
    secretKey: process.env.SUPABASE_SECRET_KEY ?? '',
    jwksUrl: process.env.SUPABASE_JWKS_URL ?? '',
  },
  redisUrl: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  expo: {
    accessToken: process.env.EXPO_ACCESS_TOKEN ?? '',
  },
  subscription: {
    priceGhs: Number(process.env.SUBSCRIPTION_PRICE_GHS) > 0 ? Number(process.env.SUBSCRIPTION_PRICE_GHS) : 50,
    periodDays: Number(process.env.SUBSCRIPTION_PERIOD_DAYS) > 0 ? Number(process.env.SUBSCRIPTION_PERIOD_DAYS) : 365,
  },
  hubtel: {
    clientId: process.env.HUBTEL_CLIENT_ID ?? '',
    clientSecret: process.env.HUBTEL_CLIENT_SECRET ?? '',
    merchantAccount: process.env.HUBTEL_MERCHANT_ACCOUNT ?? '',
    prepaidAccount: process.env.HUBTEL_PREPAID_ACCOUNT ?? '',
    callbackUrl: process.env.HUBTEL_CALLBACK_URL ?? '',
    returnUrl: process.env.HUBTEL_RETURN_URL ?? '',
  },
});
