import {
  ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { jwtVerify } from 'jose';
import { SupabaseJwtGuard } from './supabase-jwt.guard';
import type { UsersService } from '../../users/users.service';

// jose and @nestjs/config are ESM-only packages that this CommonJS test setup
// can't load; the guard only needs these few calls from them.
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => ({})),
  jwtVerify: jest.fn(),
}));
jest.mock('@nestjs/config', () => ({ ConfigService: class ConfigService {} }));
const mockJwtVerify = jwtVerify as jest.Mock;

function context(authorization?: string) {
  const request: {
    headers: Record<string, string | undefined>;
    user?: Record<string, unknown>;
  } = {
    headers: { authorization },
  };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { ctx, request };
}

function makeGuard(users: Partial<Record<keyof UsersService, jest.Mock>>) {
  const config = {
    get: (key: string) =>
      ({
        'supabase.jwksUrl':
          'https://x.supabase.co/auth/v1/.well-known/jwks.json',
        'supabase.url': 'https://x.supabase.co',
      })[key],
  } as unknown as ConfigService;
  return new SupabaseJwtGuard(config, users as unknown as UsersService);
}

const activeUser = { id: 'u1', status: 'ACTIVE' };

describe('SupabaseJwtGuard', () => {
  beforeEach(() => {
    mockJwtVerify.mockReset();
    mockJwtVerify.mockResolvedValue({
      payload: { sub: 'auth-1', email: 'a@b.com' },
    });
  });

  it('rejects a request with no bearer token', async () => {
    const guard = makeGuard({});
    await expect(guard.canActivate(context().ctx)).rejects.toMatchObject({
      response: { code: 'MISSING_TOKEN' },
    });
  });

  it('rejects an invalid or expired token as 401', async () => {
    mockJwtVerify.mockRejectedValue(new Error('jwt expired'));
    const guard = makeGuard({});
    const err: unknown = await guard
      .canActivate(context('Bearer bad').ctx)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnauthorizedException);
    expect(err).toMatchObject({ response: { code: 'INVALID_TOKEN' } });
  });

  it('lets an active user through with their roles and active role', async () => {
    const guard = makeGuard({
      ensureUser: jest.fn().mockResolvedValue({
        user: activeUser,
        roles: ['PROVIDER'],
        created: false,
      }),
      getAccessState: jest
        .fn()
        .mockResolvedValue({ activeRole: 'provider', suspended: false }),
    });
    const { ctx, request } = context('Bearer good');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.user).toMatchObject({
      id: 'auth-1',
      roles: ['PROVIDER'],
      status: 'ACTIVE',
      activeRole: 'provider',
    });
  });

  it('marks a user the admin suspended as SUSPENDED even though users.status says ACTIVE', async () => {
    const guard = makeGuard({
      ensureUser: jest.fn().mockResolvedValue({
        user: activeUser,
        roles: ['CUSTOMER'],
        created: false,
      }),
      getAccessState: jest
        .fn()
        .mockResolvedValue({ activeRole: 'customer', suspended: true }),
    });
    const { ctx, request } = context('Bearer good');
    await guard.canActivate(ctx);
    expect(request.user).toMatchObject({ status: 'SUSPENDED' });
  });

  it('refuses with 503 - not as an active customer - when the account lookup fails', async () => {
    const guard = makeGuard({
      ensureUser: jest.fn().mockRejectedValue(new Error('db down')),
      getAccessState: jest.fn(),
    });
    const { ctx, request } = context('Bearer good');
    const err: unknown = await guard.canActivate(ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect(err).toMatchObject({ response: { code: 'AUTH_LOOKUP_FAILED' } });
    expect(request.user).toBeUndefined();
  });

  it('also refuses with 503 when only the suspension lookup fails', async () => {
    const guard = makeGuard({
      ensureUser: jest.fn().mockResolvedValue({
        user: activeUser,
        roles: ['CUSTOMER'],
        created: false,
      }),
      getAccessState: jest.fn().mockRejectedValue(new Error('db down')),
    });
    await expect(
      guard.canActivate(context('Bearer good').ctx),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
