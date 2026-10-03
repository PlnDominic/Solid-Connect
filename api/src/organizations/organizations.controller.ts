import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseJwtGuard, type RequestUser } from '../auth/guards/supabase-jwt.guard';
import {
  AddMemberDto,
  CreateOrganizationDto,
  CreateProjectDto,
  CreateRecurringServiceDto,
  CreateWorkforceRequestDto,
  UpdateMemberDto,
  UpdateOrganizationDto,
  UpdateProjectDto,
  UpdateRecurringServiceDto,
} from './dto/organizations.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
@UseGuards(SupabaseJwtGuard, RolesGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async create(@CurrentUser() user: RequestUser, @Body() body: CreateOrganizationDto) {
    const data = await this.organizations.create(user.id, body);
    return { data, meta: {} };
  }

  @Get()
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async mine(@CurrentUser() user: RequestUser) {
    const data = await this.organizations.listMine(user.id);
    return { data, meta: { count: data.length } };
  }

  @Get(':orgId')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async one(@CurrentUser() user: RequestUser, @Param('orgId') orgId: string) {
    const data = await this.organizations.get(orgId, user.id);
    return { data, meta: {} };
  }

  @Patch(':orgId')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('orgId') orgId: string,
    @Body() body: UpdateOrganizationDto,
  ) {
    const data = await this.organizations.update(orgId, user.id, body);
    return { data, meta: {} };
  }

  @Post(':orgId/members')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async addMember(
    @CurrentUser() user: RequestUser,
    @Param('orgId') orgId: string,
    @Body() body: AddMemberDto,
  ) {
    const data = await this.organizations.addMember(orgId, user.id, body);
    return { data, meta: {} };
  }

  @Patch(':orgId/members/:memberId')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async updateMember(
    @CurrentUser() user: RequestUser,
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @Body() body: UpdateMemberDto,
  ) {
    const data = await this.organizations.updateMember(orgId, user.id, memberId, body);
    return { data, meta: {} };
  }

  @Delete(':orgId/members/:memberId')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async removeMember(
    @CurrentUser() user: RequestUser,
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
  ) {
    const data = await this.organizations.removeMember(orgId, user.id, memberId);
    return { data, meta: {} };
  }

  @Get(':orgId/projects')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async projects(@CurrentUser() user: RequestUser, @Param('orgId') orgId: string) {
    const data = await this.organizations.listProjects(orgId, user.id);
    return { data, meta: { count: data.length } };
  }

  @Post(':orgId/projects')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async createProject(
    @CurrentUser() user: RequestUser,
    @Param('orgId') orgId: string,
    @Body() body: CreateProjectDto,
  ) {
    const data = await this.organizations.createProject(orgId, user.id, body);
    return { data, meta: {} };
  }

  @Patch(':orgId/projects/:projectId')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async updateProject(
    @CurrentUser() user: RequestUser,
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Body() body: UpdateProjectDto,
  ) {
    const data = await this.organizations.updateProject(orgId, projectId, user.id, body);
    return { data, meta: {} };
  }

  @Get(':orgId/requests')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async requests(@CurrentUser() user: RequestUser, @Param('orgId') orgId: string) {
    const data = await this.organizations.listWorkforceRequests(orgId, user.id);
    return { data, meta: { count: data.length } };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':orgId/requests')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async createRequest(
    @CurrentUser() user: RequestUser,
    @Param('orgId') orgId: string,
    @Body() body: CreateWorkforceRequestDto,
  ) {
    const data = await this.organizations.createWorkforceRequest(orgId, user.id, body);
    return { data, meta: { matchedCount: data.matchedCount } };
  }

  @Post(':orgId/recurring')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async createRecurring(
    @CurrentUser() user: RequestUser,
    @Param('orgId') orgId: string,
    @Body() body: CreateRecurringServiceDto,
  ) {
    const data = await this.organizations.createRecurring(orgId, user.id, body);
    return { data, meta: {} };
  }

  @Patch(':orgId/recurring/:recurringId')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async updateRecurring(
    @CurrentUser() user: RequestUser,
    @Param('orgId') orgId: string,
    @Param('recurringId') recurringId: string,
    @Body() body: UpdateRecurringServiceDto,
  ) {
    const data = await this.organizations.updateRecurring(orgId, recurringId, user.id, body);
    return { data, meta: {} };
  }
}
