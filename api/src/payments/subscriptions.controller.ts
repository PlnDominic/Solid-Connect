import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { RequestUser } from '../auth/guards/supabase-jwt.guard';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('subscriptions')
@Controller('subscriptions')
@ApiBearerAuth()
@UseGuards(SupabaseJwtGuard, RolesGuard)
@Roles('PROVIDER', 'PROFESSIONAL')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('me')
  async me(@CurrentUser() user: RequestUser) {
    return { data: await this.subscriptions.status(user.id), meta: {} };
  }

  @Post('checkout')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  async checkout(@CurrentUser() user: RequestUser) {
    return { data: await this.subscriptions.checkout(user.id), meta: {} };
  }

  @Post('refresh')
  async refresh(@CurrentUser() user: RequestUser) {
    return { data: await this.subscriptions.refresh(user.id), meta: {} };
  }
}
