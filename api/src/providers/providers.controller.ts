import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { RequestUser } from '../auth/guards/supabase-jwt.guard';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import {
  AvailabilityModeDto,
  ReplaceServiceAreasDto,
  ReplaceWeeklyAvailabilityDto,
  SearchProvidersQueryDto,
  SetSkillsDto,
} from './dto/providers.dto';
import { ProvidersLocationService } from './providers-location.service';

@ApiTags('providers')
@ApiBearerAuth()
@Controller('providers')
@UseGuards(SupabaseJwtGuard, RolesGuard)
export class ProvidersController {
  constructor(
    private readonly users: UsersService,
    private readonly supabase: SupabaseService,
    private readonly location: ProvidersLocationService,
  ) {}

  @Get('search')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async search(@Query() query: SearchProvidersQueryDto) {
    const data = await this.location.search(query);
    return { data, meta: { count: data.length } };
  }

  @Get('me/skills')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async mySkills(@CurrentUser() user: RequestUser) {
    const { data, error } = await this.supabase.client
      .from('provider_skills')
      .select('skill_id, years_experience, verification_status, skills(id, name, category_id)')
      .eq('provider_id', user.id);
    if (error) throw error;
    return { data: data ?? [], meta: {} };
  }

  @Put('me/skills')
  @Roles('PROVIDER', 'PROFESSIONAL', 'ADMIN', 'SUPER_ADMIN')
  async setMySkills(@CurrentUser() user: RequestUser, @Body() body: SetSkillsDto) {
    await this.users.setProviderSkills(user.id, body.skillIds, body.yearsExperience ?? 0);
    return this.mySkills(user);
  }

  @Get('me/service-areas')
  @Roles('PROVIDER', 'PROFESSIONAL', 'ADMIN', 'SUPER_ADMIN')
  async myServiceAreas(@CurrentUser() user: RequestUser) {
    const data = await this.location.listServiceAreas(user.id);
    return { data, meta: {} };
  }

  @Put('me/service-areas')
  @Roles('PROVIDER', 'PROFESSIONAL', 'ADMIN', 'SUPER_ADMIN')
  async setMyServiceAreas(@CurrentUser() user: RequestUser, @Body() body: ReplaceServiceAreasDto) {
    const data = await this.location.replaceServiceAreas(user.id, body.areas);
    return { data, meta: {} };
  }

  @Get('me/availability')
  @Roles('PROVIDER', 'PROFESSIONAL', 'ADMIN', 'SUPER_ADMIN')
  async myAvailability(@CurrentUser() user: RequestUser) {
    const data = await this.location.listAvailability(user.id);
    return { data, meta: {} };
  }

  @Put('me/availability/mode')
  @Roles('PROVIDER', 'PROFESSIONAL', 'ADMIN', 'SUPER_ADMIN')
  async setAvailabilityMode(@CurrentUser() user: RequestUser, @Body() body: AvailabilityModeDto) {
    const data = await this.location.setAvailabilityMode(user.id, body.mode);
    return { data, meta: {} };
  }

  @Put('me/availability/weekly')
  @Roles('PROVIDER', 'PROFESSIONAL', 'ADMIN', 'SUPER_ADMIN')
  async setWeeklyAvailability(
    @CurrentUser() user: RequestUser,
    @Body() body: ReplaceWeeklyAvailabilityDto,
  ) {
    const weekly = await this.location.replaceWeeklyAvailability(user.id, body.slots);
    return { data: { mode: 'SCHEDULE', weekly }, meta: {} };
  }

  @Get('me/verification')
  @Roles('PROVIDER', 'PROFESSIONAL', 'ADMIN', 'SUPER_ADMIN')
  async myVerification(@CurrentUser() user: RequestUser) {
    const data = await this.location.getVerificationSummary(user.id);
    return { data, meta: {} };
  }

  @Get(':id/skills')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async providerSkills(@Param('id') id: string) {
    const { data, error } = await this.supabase.client
      .from('provider_skills')
      .select('skill_id, years_experience, verification_status, skills(id, name, category_id)')
      .eq('provider_id', id);
    if (error) throw error;
    return { data: data ?? [], meta: {} };
  }

  @Get(':id/verification')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async providerVerification(@Param('id') id: string) {
    const data = await this.location.getVerificationSummary(id);
    return { data, meta: {} };
  }

  @Get(':id/service-areas')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async providerServiceAreas(@Param('id') id: string) {
    const data = await this.location.listServiceAreas(id);
    return { data, meta: {} };
  }

  @Get(':id/portfolio')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async providerPortfolio(@Param('id') id: string) {
    const { data, error } = await this.supabase.client
      .from('provider_portfolio_photos')
      .select('id, provider_id, photo_url, created_at')
      .eq('provider_id', id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { data: data ?? [], meta: {} };
  }
}
