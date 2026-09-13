import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { RequestUser } from '../auth/guards/supabase-jwt.guard';
import { CreateRequestDto, RejectDirectRequestDto } from './dto/requests.dto';
import { RequestsService } from './requests.service';

@ApiTags('requests')
@ApiBearerAuth()
@Controller('requests')
@UseGuards(SupabaseJwtGuard, RolesGuard)
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  // Posting a job runs the matching scan against every eligible provider -
  // real customers post a handful of jobs a day at most, so 10/min is
  // generous for genuine use and blocks a scripted flood of fake requests.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async create(@CurrentUser() user: RequestUser, @Body() body: CreateRequestDto) {
    const data = await this.requests.create(user.id, body);
    return { data, meta: { matchedCount: data.matchedCount } };
  }

  @Get('me')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async mine(@CurrentUser() user: RequestUser) {
    const data = await this.requests.listMine(user.id);
    return { data, meta: {} };
  }

  @Get('notifications')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async notifications(@CurrentUser() user: RequestUser) {
    const data = await this.requests.listNotifications(user.id);
    return { data, meta: { unread: data.filter((n) => !n.read_at).length } };
  }

  @Patch('notifications/:id/read')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async readNotification(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const data = await this.requests.markNotificationRead(user.id, id);
    return { data, meta: {} };
  }

  @Get(':id')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async one(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const data = await this.requests.getRequest(id, user.id);
    return { data, meta: {} };
  }

  @Get(':id/opportunities')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async opportunities(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const data = await this.requests.listOpportunities(id, user.id);
    return { data, meta: { count: data.length } };
  }

  // The most expensive route in this controller - runMatching() rescans
  // every eligible provider for this request. Nothing legitimate calls it
  // more than a couple of times per request lifecycle.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(':id/match')
  @Roles('CUSTOMER', 'ADMIN', 'SUPER_ADMIN')
  async rematch(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const request = await this.requests.getRequest(id, user.id);
    const isAdmin = user.roles.includes('ADMIN') || user.roles.includes('SUPER_ADMIN');
    if (request.customer_id !== user.id && !isAdmin) {
      throw new ForbiddenException({ code: 'REQUEST_FORBIDDEN', message: 'Not allowed to rematch.' });
    }
    if (request.request_mode === 'DIRECT') {
      throw new BadRequestException({
        code: 'DIRECT_NO_REMATCH',
        message: 'Direct requests cannot be rematched to the open market.',
      });
    }
    const opportunities = await this.requests.runMatching(id);
    return { data: { opportunities }, meta: { matchedCount: opportunities.length } };
  }

  // Direct-request decisions are one-time state transitions per request -
  // 10/min is well above any genuine usage and stops a retry loop (buggy
  // client or scripted abuse) from hammering the accept/reject path.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/accept-direct')
  @Roles('PROVIDER', 'PROFESSIONAL', 'ADMIN', 'SUPER_ADMIN')
  async acceptDirect(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const data = await this.requests.acceptDirect(id, user.id);
    return { data, meta: {} };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/reject-direct')
  @Roles('PROVIDER', 'PROFESSIONAL', 'ADMIN', 'SUPER_ADMIN')
  async rejectDirect(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: RejectDirectRequestDto,
  ) {
    const data = await this.requests.rejectDirect(id, user.id, body.reason);
    return { data, meta: {} };
  }
}
