import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Request } from 'express';
import { UsersService } from '../../users/users.service';
import type { RoleCode, UserStatus } from '../../users/users.types';

export type RequestUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  roles: RoleCode[];
  status: UserStatus;
  activeRole?: 'customer' | 'provider' | null;
};

@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
  ) {}

  private getJwks() {
    if (this.jwks) return this.jwks;
    const jwksUrl = this.config.get<string>('supabase.jwksUrl');
    if (!jwksUrl) {
      throw new UnauthorizedException({
        code: 'AUTH_MISCONFIGURED',
        message: 'SUPABASE_JWKS_URL is not configured.',
      });
    }
    this.jwks = createRemoteJWKSet(new URL(jwksUrl));
    return this.jwks;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'MISSING_TOKEN',
        message: 'Authorization Bearer token is required.',
      });
    }

    const token = header.slice('Bearer '.length).trim();
    let sub: string;
    let email: string | null;
    let phone: string | null;
    try {
      const { payload } = await jwtVerify(token, this.getJwks(), {
        issuer: `${this.config.get<string>('supabase.url')}/auth/v1`,
        audience: 'authenticated',
      });

      const subject = typeof payload.sub === 'string' ? payload.sub : null;
      if (!subject) {
        throw new UnauthorizedException({
          code: 'INVALID_TOKEN',
          message: 'Token subject is missing.',
        });
      }
      sub = subject;
      email = typeof payload.email === 'string' ? payload.email : null;
      phone = typeof payload.phone === 'string' ? payload.phone : null;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Access token is invalid or expired.',
      });
    }

    // Who this is and whether they may act. If the lookup fails we cannot
    // tell a suspended account from a good one, so refuse (503, which the app
    // treats as "try again") rather than let the request through as an
    // active customer.
    let roles: RoleCode[];
    let status: UserStatus;
    let activeRole: 'customer' | 'provider' | null;
    try {
      const ensured = await this.users.ensureUser({
        authUserId: sub,
        email,
        phone,
      });
      roles = ensured.roles.length ? ensured.roles : ['CUSTOMER'];
      status = ensured.user.status;
      const access = await this.users.getAccessState(sub);
      activeRole = access.activeRole;
      // An admin suspension sets profiles.suspended_at (the admin site never
      // touches users.status), so honour it here as well.
      if (access.suspended) status = 'SUSPENDED';
    } catch {
      throw new ServiceUnavailableException({
        code: 'AUTH_LOOKUP_FAILED',
        message: 'Could not verify your account right now. Please try again.',
      });
    }

    request.user = { id: sub, email, phone, roles, status, activeRole };
    return true;
  }
}
