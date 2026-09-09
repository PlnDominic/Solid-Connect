import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { RequestUser } from '../auth/guards/supabase-jwt.guard';
import { JobsService } from './jobs.service';

@ApiTags('jobs')
@ApiBearerAuth()
@Controller('jobs')
@UseGuards(SupabaseJwtGuard, RolesGuard)
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get('me')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async mine(@CurrentUser() user: RequestUser, @Query('role') role?: 'customer' | 'provider') {
    const data = await this.jobs.listMine(user.id, role);
    return { data, meta: {} };
  }

  @Get(':id')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async one(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const data = await this.jobs.getJob(id, user.id);
    return { data, meta: {} };
  }

  @Get(':id/events')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async events(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const data = await this.jobs.listEvents(id, user.id);
    return { data, meta: { count: data.length } };
  }

  @Post(':id/start')
  @Roles('PROVIDER', 'PROFESSIONAL', 'ADMIN', 'SUPER_ADMIN')
  async start(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const data = await this.jobs.start(id, user.id);
    return { data, meta: {} };
  }

  @Post(':id/finish')
  @Roles('PROVIDER', 'PROFESSIONAL', 'ADMIN', 'SUPER_ADMIN')
  async finish(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const data = await this.jobs.finish(id, user.id);
    return { data, meta: {} };
  }

  @Post(':id/advance')
  @Roles('PROVIDER', 'PROFESSIONAL', 'ADMIN', 'SUPER_ADMIN')
  async advance(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const data = await this.jobs.advance(id, user.id);
    return { data, meta: {} };
  }

  @Post(':id/confirm')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async confirm(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const data = await this.jobs.confirm(id, user.id);
    return { data, meta: {} };
  }
}
