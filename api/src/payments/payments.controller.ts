import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { RequestUser } from '../auth/guards/supabase-jwt.guard';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('jobs/:jobId/checkout')
  @ApiBearerAuth()
  @UseGuards(SupabaseJwtGuard, RolesGuard)
  @Roles('CUSTOMER', 'ADMIN', 'SUPER_ADMIN')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async checkout(@CurrentUser() user: RequestUser, @Param('jobId') jobId: string) {
    const data = await this.payments.checkout(jobId, user.id);
    return { data, meta: {} };
  }

  @Post('jobs/:jobId/refresh')
  @ApiBearerAuth()
  @UseGuards(SupabaseJwtGuard, RolesGuard)
  @Roles('CUSTOMER', 'ADMIN', 'SUPER_ADMIN')
  async refresh(@CurrentUser() user: RequestUser, @Param('jobId') jobId: string) {
    const data = await this.payments.refresh(jobId, user.id);
    return { data, meta: {} };
  }

  /** Hubtel server callback. Outcome is confirmed with Hubtel's status API. */
  @Post('webhooks/hubtel')
  @SkipThrottle()
  async webhook(@Body() body: Record<string, unknown>) {
    const data = await this.payments.handleCallback(body ?? {});
    return data;
  }
}
