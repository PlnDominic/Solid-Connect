import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { RequestUser } from '../auth/guards/supabase-jwt.guard';
import { CreateDisputeDto, CreateReviewDto } from './dto/trust.dto';
import { TrustService } from './trust.service';

@ApiTags('trust')
@ApiBearerAuth()
@Controller()
@UseGuards(SupabaseJwtGuard, RolesGuard)
export class TrustController {
  constructor(private readonly trust: TrustService) {}

  @Post('reviews')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Roles('CUSTOMER', 'ADMIN', 'SUPER_ADMIN')
  async review(@CurrentUser() user: RequestUser, @Body() body: CreateReviewDto) {
    const data = await this.trust.createReview(user.id, body);
    return { data, meta: {} };
  }

  @Get('reviews')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async list(@Query('providerId') providerId: string) {
    const data = await this.trust.providerReviews(providerId);
    return { data, meta: { count: data.length } };
  }

  @Post('disputes')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Roles('CUSTOMER', 'ADMIN', 'SUPER_ADMIN')
  async dispute(@CurrentUser() user: RequestUser, @Body() body: CreateDisputeDto) {
    const data = await this.trust.createDispute(user.id, body);
    return { data, meta: {} };
  }

  @Get('jobs/:jobId/dispute')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async jobDispute(@CurrentUser() user: RequestUser, @Param('jobId') jobId: string) {
    const data = await this.trust.jobDispute(jobId, user.id);
    return { data, meta: {} };
  }
}
