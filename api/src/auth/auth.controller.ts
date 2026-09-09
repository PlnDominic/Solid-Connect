import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from '../users/users.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { BecomeProviderDto, SwitchRoleDto, SyncAuthDto } from './dto/auth.dto';
import { RolesGuard } from './guards/roles.guard';
import { SupabaseJwtGuard } from './guards/supabase-jwt.guard';
import type { RequestUser } from './guards/supabase-jwt.guard';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
@UseGuards(SupabaseJwtGuard, RolesGuard)
export class AuthController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async me(@CurrentUser() user: RequestUser) {
    const ensured = await this.users.ensureUser({
      authUserId: user.id,
      email: user.email,
      phone: user.phone,
    });
    return {
      data: {
        id: ensured.user.id,
        authUserId: ensured.user.auth_user_id,
        email: ensured.user.email,
        phone: ensured.user.phone,
        status: ensured.user.status,
        firstName: ensured.user.first_name,
        lastName: ensured.user.last_name,
        roles: ensured.roles,
        activeRole: user.activeRole ?? null,
      },
      meta: { created: ensured.created },
    };
  }

  @Post('sync')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async sync(@CurrentUser() user: RequestUser, @Body() body: SyncAuthDto) {
    const ensured = await this.users.ensureUser({
      authUserId: user.id,
      email: user.email,
      phone: body.phone ?? user.phone,
      fullName: body.fullName,
    });
    return {
      data: {
        id: ensured.user.id,
        authUserId: ensured.user.auth_user_id,
        roles: ensured.roles,
        status: ensured.user.status,
      },
      meta: {
        created: ensured.created,
        event: ensured.created ? 'user.registered' : 'user.synced',
      },
    };
  }

  @Post('become-provider')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async becomeProvider(@CurrentUser() user: RequestUser, @Body() body: BecomeProviderDto) {
    const result = await this.users.becomeProvider(user.id, body);
    return {
      data: {
        id: result.user.id,
        roles: result.roles,
        activeRole: 'provider',
        profileId: result.profile.id,
      },
      meta: { event: result.event },
    };
  }

  @Post('switch-role')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async switchRole(@CurrentUser() user: RequestUser, @Body() body: SwitchRoleDto) {
    const result = await this.users.switchActiveRole(user.id, body.role);
    return {
      data: {
        id: result.user.id,
        roles: result.roles,
        activeRole: result.activeRole,
        profile: result.profile,
      },
      meta: {},
    };
  }
}
