import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { RequestsService } from '../requests/requests.service';
import { canManageMembers, nextRunAfter, type OrgMemberRole } from './org.rules';
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

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly users: UsersService,
    private readonly requests: RequestsService,
  ) {}

  async create(profileId: string, dto: CreateOrganizationDto) {
    const name = dto.name.trim();
    if (name.length < 2) {
      throw new BadRequestException({ code: 'NAME_REQUIRED', message: 'Organization name is required.' });
    }

    const { data: org, error } = await this.supabase.client
      .from('organizations')
      .insert({
        name,
        description: dto.description?.trim() || '',
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
        area: dto.area?.trim() || null,
        owner_id: profileId,
        status: 'active',
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException({ code: 'ORG_CREATE_FAILED', message: error.message });

    const { error: memberErr } = await this.supabase.client.from('organization_members').insert({
      organization_id: org.id,
      profile_id: profileId,
      role: 'owner',
    });
    if (memberErr) throw new BadRequestException({ code: 'ORG_MEMBER_FAILED', message: memberErr.message });

    await this.grantOrgRole(profileId);
    return org;
  }

  async listMine(profileId: string) {
    const { data: memberships, error } = await this.supabase.client
      .from('organization_members')
      .select('role, organizations(*)')
      .eq('profile_id', profileId);
    if (error) throw new BadRequestException({ code: 'ORG_LIST_FAILED', message: error.message });

    return (memberships ?? []).map((row: { role: string; organizations: unknown }) => {
      const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
      return { ...(org as Record<string, unknown>), myRole: row.role };
    });
  }

  async get(orgId: string, profileId: string) {
    await this.requireMember(orgId, profileId);
    const { data: org, error } = await this.supabase.client.from('organizations').select('*').eq('id', orgId).maybeSingle();
    if (error) throw new BadRequestException({ code: 'ORG_LOOKUP_FAILED', message: error.message });
    if (!org) throw new NotFoundException({ code: 'ORG_NOT_FOUND', message: 'Organization not found.' });

    const [{ data: members }, { data: projects }, { data: recurring }] = await Promise.all([
      this.supabase.client
        .from('organization_members')
        .select('profile_id, role, created_at, profiles(id, full_name, initials, email, phone)')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true }),
      this.supabase.client
        .from('projects')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(50),
      this.supabase.client
        .from('recurring_services')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    return { ...org, members: members ?? [], projects: projects ?? [], recurring: recurring ?? [] };
  }

  async update(orgId: string, profileId: string, dto: UpdateOrganizationDto) {
    await this.requireAdmin(orgId, profileId);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (dto.name != null) patch.name = dto.name.trim();
    if (dto.description != null) patch.description = dto.description.trim();
    if (dto.phone != null) patch.phone = dto.phone.trim() || null;
    if (dto.email != null) patch.email = dto.email.trim() || null;
    if (dto.area != null) patch.area = dto.area.trim() || null;

    const { data, error } = await this.supabase.client
      .from('organizations')
      .update(patch)
      .eq('id', orgId)
      .select('*')
      .single();
    if (error) throw new BadRequestException({ code: 'ORG_UPDATE_FAILED', message: error.message });
    return data;
  }

  async addMember(orgId: string, actorId: string, dto: AddMemberDto) {
    await this.requireAdmin(orgId, actorId);
    if (dto.profileId === actorId) {
      throw new BadRequestException({ code: 'ALREADY_MEMBER', message: 'You are already a member.' });
    }
    const { data: profile } = await this.supabase.client
      .from('profiles')
      .select('id')
      .eq('id', dto.profileId)
      .maybeSingle();
    if (!profile) throw new NotFoundException({ code: 'PROFILE_NOT_FOUND', message: 'User not found.' });

    const { data: existing } = await this.supabase.client
      .from('organization_members')
      .select('profile_id')
      .eq('organization_id', orgId)
      .eq('profile_id', dto.profileId)
      .maybeSingle();
    if (existing) throw new ConflictException({ code: 'ALREADY_MEMBER', message: 'That user is already a member.' });

    const role = dto.role ?? 'member';
    const { data, error } = await this.supabase.client
      .from('organization_members')
      .insert({ organization_id: orgId, profile_id: dto.profileId, role })
      .select('*')
      .single();
    if (error) throw new BadRequestException({ code: 'ORG_MEMBER_FAILED', message: error.message });

    await this.grantOrgRole(dto.profileId);
    await this.supabase.client.from('notifications').insert({
      user_id: dto.profileId,
      type: 'ORG_MEMBER_ADDED',
      title: 'Added to an organization',
      body: 'You were added to a Solid Connect organization.',
      data: { organizationId: orgId },
    });
    return data;
  }

  async updateMember(orgId: string, actorId: string, memberId: string, dto: UpdateMemberDto) {
    await this.requireAdmin(orgId, actorId);
    const membership = await this.membership(orgId, memberId);
    if (!membership) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member not found.' });
    if (membership.role === 'owner') {
      throw new ForbiddenException({ code: 'OWNER_IMMUTABLE', message: 'The organization owner cannot be demoted here.' });
    }

    const { data, error } = await this.supabase.client
      .from('organization_members')
      .update({ role: dto.role })
      .eq('organization_id', orgId)
      .eq('profile_id', memberId)
      .select('*')
      .single();
    if (error) throw new BadRequestException({ code: 'ORG_MEMBER_UPDATE_FAILED', message: error.message });
    return data;
  }

  async removeMember(orgId: string, actorId: string, memberId: string) {
    await this.requireAdmin(orgId, actorId);
    const membership = await this.membership(orgId, memberId);
    if (!membership) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member not found.' });
    if (membership.role === 'owner') {
      throw new ForbiddenException({ code: 'OWNER_IMMUTABLE', message: 'The organization owner cannot be removed.' });
    }

    const { error } = await this.supabase.client
      .from('organization_members')
      .delete()
      .eq('organization_id', orgId)
      .eq('profile_id', memberId);
    if (error) throw new BadRequestException({ code: 'ORG_MEMBER_REMOVE_FAILED', message: error.message });
    return { ok: true };
  }

  async createProject(orgId: string, profileId: string, dto: CreateProjectDto) {
    await this.requireMember(orgId, profileId);
    const { data, error } = await this.supabase.client
      .from('projects')
      .insert({
        organization_id: orgId,
        title: dto.title.trim(),
        description: dto.description?.trim() || '',
        location_label: dto.locationLabel?.trim() || '',
        status: 'open',
        created_by: profileId,
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException({ code: 'PROJECT_CREATE_FAILED', message: error.message });
    return data;
  }

  async updateProject(orgId: string, projectId: string, profileId: string, dto: UpdateProjectDto) {
    await this.requireMember(orgId, profileId);
    const project = await this.projectInOrg(orgId, projectId);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (dto.title != null) patch.title = dto.title.trim();
    if (dto.description != null) patch.description = dto.description.trim();
    if (dto.locationLabel != null) patch.location_label = dto.locationLabel.trim();
    if (dto.status != null) patch.status = dto.status;

    const { data, error } = await this.supabase.client
      .from('projects')
      .update(patch)
      .eq('id', project.id)
      .select('*')
      .single();
    if (error) throw new BadRequestException({ code: 'PROJECT_UPDATE_FAILED', message: error.message });
    return data;
  }

  async listProjects(orgId: string, profileId: string) {
    await this.requireMember(orgId, profileId);
    const { data, error } = await this.supabase.client
      .from('projects')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    if (error) throw new BadRequestException({ code: 'PROJECT_LIST_FAILED', message: error.message });
    return data ?? [];
  }

  async createWorkforceRequest(orgId: string, profileId: string, dto: CreateWorkforceRequestDto) {
    await this.requireMember(orgId, profileId);
    if (dto.projectId) await this.projectInOrg(orgId, dto.projectId);

    const created = await this.requests.create(profileId, {
      categoryId: dto.categoryId,
      categoryLabel: dto.categoryLabel,
      description: dto.description,
      locationLabel: dto.locationLabel,
      budget: dto.budget,
      preferredProviderId: dto.preferredProviderId,
      organizationId: orgId,
      projectId: dto.projectId,
    });
    return created;
  }

  async listWorkforceRequests(orgId: string, profileId: string) {
    await this.requireMember(orgId, profileId);
    const { data, error } = await this.supabase.client
      .from('service_requests')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new BadRequestException({ code: 'ORG_REQUESTS_FAILED', message: error.message });
    return data ?? [];
  }

  async createRecurring(orgId: string, profileId: string, dto: CreateRecurringServiceDto) {
    await this.requireAdmin(orgId, profileId);
    if (dto.projectId) await this.projectInOrg(orgId, dto.projectId);
    const nextRunAt = dto.nextRunAt ? new Date(dto.nextRunAt) : new Date();
    if (Number.isNaN(nextRunAt.getTime())) {
      throw new BadRequestException({ code: 'INVALID_NEXT_RUN', message: 'nextRunAt must be a valid date.' });
    }

    const { data, error } = await this.supabase.client
      .from('recurring_services')
      .insert({
        organization_id: orgId,
        project_id: dto.projectId ?? null,
        category_id: dto.categoryId,
        category_label: dto.categoryLabel,
        description: dto.description.trim(),
        location_label: dto.locationLabel.trim(),
        budget: dto.budget,
        cadence: dto.cadence,
        next_run_at: nextRunAt.toISOString(),
        active: true,
        created_by: profileId,
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException({ code: 'RECURRING_CREATE_FAILED', message: error.message });
    return data;
  }

  async updateRecurring(orgId: string, recurringId: string, profileId: string, dto: UpdateRecurringServiceDto) {
    await this.requireAdmin(orgId, profileId);
    const { data: existing } = await this.supabase.client
      .from('recurring_services')
      .select('*')
      .eq('id', recurringId)
      .eq('organization_id', orgId)
      .maybeSingle();
    if (!existing) throw new NotFoundException({ code: 'RECURRING_NOT_FOUND', message: 'Recurring service not found.' });

    const patch: Record<string, unknown> = {};
    if (dto.active != null) patch.active = dto.active;
    if (dto.cadence != null) patch.cadence = dto.cadence;
    if (dto.nextRunAt != null) {
      const next = new Date(dto.nextRunAt);
      if (Number.isNaN(next.getTime())) {
        throw new BadRequestException({ code: 'INVALID_NEXT_RUN', message: 'nextRunAt must be a valid date.' });
      }
      patch.next_run_at = next.toISOString();
    }

    const { data, error } = await this.supabase.client
      .from('recurring_services')
      .update(patch)
      .eq('id', recurringId)
      .select('*')
      .single();
    if (error) throw new BadRequestException({ code: 'RECURRING_UPDATE_FAILED', message: error.message });
    return data;
  }

  /** Background: create workforce requests for due recurring services. */
  async processDueRecurring(): Promise<number> {
    const now = new Date().toISOString();
    const { data: due, error } = await this.supabase.client
      .from('recurring_services')
      .select('*')
      .eq('active', true)
      .lte('next_run_at', now)
      .limit(20);
    if (error || !due?.length) return 0;

    let processed = 0;
    for (const row of due) {
      try {
        await this.requests.create(row.created_by, {
          categoryId: row.category_id,
          categoryLabel: row.category_label,
          description: row.description || `Recurring ${row.category_label} service`,
          locationLabel: row.location_label,
          budget: row.budget,
          organizationId: row.organization_id,
          projectId: row.project_id ?? undefined,
        });
        const next = nextRunAfter(row.cadence, new Date(row.next_run_at));
        await this.supabase.client
          .from('recurring_services')
          .update({ last_run_at: now, next_run_at: next.toISOString() })
          .eq('id', row.id);
        processed += 1;
      } catch {
        // Leave next_run_at so a later tick can retry; skip this row this round.
      }
    }
    return processed;
  }

  private async grantOrgRole(profileId: string) {
    try {
      const appUser = await this.users.findByAuthId(profileId);
      if (appUser) await this.users.grantRole(appUser.id, 'ORGANIZATION_MEMBER');
    } catch {
      // Role grant is best-effort; membership row is the source of truth for org access.
    }
  }

  private async membership(orgId: string, profileId: string) {
    const { data } = await this.supabase.client
      .from('organization_members')
      .select('profile_id, role')
      .eq('organization_id', orgId)
      .eq('profile_id', profileId)
      .maybeSingle();
    return data as { profile_id: string; role: OrgMemberRole } | null;
  }

  private async requireMember(orgId: string, profileId: string) {
    const m = await this.membership(orgId, profileId);
    if (!m) throw new ForbiddenException({ code: 'NOT_ORG_MEMBER', message: 'Not a member of this organization.' });
    return m;
  }

  private async requireAdmin(orgId: string, profileId: string) {
    const m = await this.requireMember(orgId, profileId);
    if (!canManageMembers(m.role)) {
      throw new ForbiddenException({ code: 'NOT_ORG_ADMIN', message: 'Only organization owners and admins can do this.' });
    }
    return m;
  }

  private async projectInOrg(orgId: string, projectId: string) {
    const { data, error } = await this.supabase.client
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('organization_id', orgId)
      .maybeSingle();
    if (error) throw new BadRequestException({ code: 'PROJECT_LOOKUP_FAILED', message: error.message });
    if (!data) throw new NotFoundException({ code: 'PROJECT_NOT_FOUND', message: 'Project not found in this organization.' });
    return data;
  }
}
