import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { RequestUser } from '../auth/guards/supabase-jwt.guard';
import { RequestsService } from '../requests/requests.service';

@ApiTags('feed')
@ApiBearerAuth()
@Controller('feed')
@UseGuards(SupabaseJwtGuard, RolesGuard)
export class FeedController {
  constructor(private readonly requests: RequestsService) {}

  @Get('opportunities')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Roles('PROVIDER', 'PROFESSIONAL', 'ADMIN', 'SUPER_ADMIN')
  async opportunities(@CurrentUser() user: RequestUser) {
    const data = await this.requests.providerFeed(user.id);
    return { data, meta: { count: data.length } };
  }
}
