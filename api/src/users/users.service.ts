import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { RoleCode, UserStatus } from './users.types';

export type AppUserRecord = {
  id: string;
  auth_user_id: string;
  email: string | null;
  phone: string | null;
  status: UserStatus;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  preferred_language: string;
  last_login_at: string | null;
};

@Injectable()
export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  async ensureUser(input: {
    authUserId: string;
    email?: string | null;
    phone?: string | null;
    fullName?: string | null;
  }): Promise<{ user: AppUserRecord; roles: RoleCode[]; created: boolean }> {
    const existing = await this.findByAuthId(input.authUserId);
    if (existing) {
      await this.touchLogin(existing.id);
      const roles = await this.getRoleCodes(existing.id);
      return { user: existing, roles, created: false };
    }

    const { first, last } = splitName(input.fullName);
    const { data, error } = await this.supabase.client
      .from('users')
      .insert({
        auth_user_id: input.authUserId,
        email: input.email ?? null,
        phone: input.phone ?? null,
        first_name: first,
        last_name: last,
        status: 'ACTIVE',
        last_login_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException({ code: 'USER_CREATE_FAILED', message: error.message });

    await this.grantRole(data.id, 'CUSTOMER');

    // Mirror profile active role if present
    const { data: profile } = await this.supabase.client
      .from('profiles')
      .select('role')
      .eq('id', input.authUserId)
      .maybeSingle();
    if (profile?.role === 'provider') {
      await this.grantRole(data.id, 'PROVIDER');
    }

    const roles = await this.getRoleCodes(data.id);
    return { user: data as AppUserRecord, roles, created: true };
  }

  async findByAuthId(authUserId: string): Promise<AppUserRecord | null> {
    const { data, error } = await this.supabase.client
      .from('users')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    if (error) throw new BadRequestException({ code: 'USER_LOOKUP_FAILED', message: error.message });
    return (data as AppUserRecord) ?? null;
  }

  async getRoleCodes(userId: string): Promise<RoleCode[]> {
    const { data, error } = await this.supabase.client
      .from('user_roles')
      .select('roles(code)')
      .eq('user_id', userId);
    if (error) throw new BadRequestException({ code: 'ROLES_LOOKUP_FAILED', message: error.message });
    return (data ?? [])
      .map((row: { roles?: { code?: string } | { code?: string }[] | null }) => {
        const r = row.roles;
        if (Array.isArray(r)) return r[0]?.code;
        return r?.code;
      })
      .filter((c): c is RoleCode => typeof c === 'string');
  }

  async getActiveRole(authUserId: string): Promise<'customer' | 'provider' | null> {
    const { data } = await this.supabase.client
      .from('profiles')
      .select('role')
      .eq('id', authUserId)
      .maybeSingle();
    if (data?.role === 'provider' || data?.role === 'customer') return data.role;
    return null;
  }

  async grantRole(userId: string, code: RoleCode): Promise<void> {
    const roleId = await this.roleId(code);
    const { error } = await this.supabase.client
      .from('user_roles')
      .upsert({ user_id: userId, role_id: roleId }, { onConflict: 'user_id,role_id' });
    if (error) throw new BadRequestException({ code: 'ROLE_GRANT_FAILED', message: error.message });
  }

  async becomeProvider(authUserId: string, input: { category?: string; skillIds?: string[] }) {
    const ensured = await this.ensureUser({ authUserId });
    if (ensured.user.status === 'SUSPENDED' || ensured.user.status === 'DISABLED') {
      throw new ForbiddenException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'This account cannot perform marketplace operations.',
      });
    }

    await this.grantRole(ensured.user.id, 'PROVIDER');

    const { data: profile, error: profileError } = await this.supabase.client
      .from('profiles')
      .update({
        role: 'provider',
        provider_category: input.category?.trim() || undefined,
      })
      .eq('id', authUserId)
      .select('*')
      .maybeSingle();
    if (profileError) {
      throw new BadRequestException({ code: 'PROFILE_UPDATE_FAILED', message: profileError.message });
    }
    if (!profile) {
      throw new NotFoundException({
        code: 'PROFILE_NOT_FOUND',
        message: 'Create a profile before becoming a provider.',
      });
    }

    if (input.skillIds?.length) {
      await this.setProviderSkills(authUserId, input.skillIds);
    }

    const roles = await this.getRoleCodes(ensured.user.id);
    return { user: ensured.user, roles, profile, event: 'provider.profile_completed' as const };
  }

  async switchActiveRole(authUserId: string, role: 'customer' | 'provider') {
    const ensured = await this.ensureUser({ authUserId });
    const roles = await this.getRoleCodes(ensured.user.id);

    if (role === 'provider' && !roles.includes('PROVIDER')) {
      throw new ForbiddenException({
        code: 'MISSING_PROVIDER_ROLE',
        message: 'Become a provider before switching to provider mode.',
      });
    }
    if (role === 'customer' && !roles.includes('CUSTOMER')) {
      await this.grantRole(ensured.user.id, 'CUSTOMER');
    }

    const { data: profile, error } = await this.supabase.client
      .from('profiles')
      .update({ role })
      .eq('id', authUserId)
      .select('*')
      .single();
    if (error) throw new BadRequestException({ code: 'ROLE_SWITCH_FAILED', message: error.message });

    return {
      user: ensured.user,
      roles: await this.getRoleCodes(ensured.user.id),
      activeRole: role,
      profile,
    };
  }

  async setProviderSkills(providerId: string, skillIds: string[], years = 0) {
    const rows = skillIds.map((skillId) => ({
      provider_id: providerId,
      skill_id: skillId,
      years_experience: years,
      verification_status: 'UNVERIFIED',
      updated_at: new Date().toISOString(),
    }));
    const { error } = await this.supabase.client.from('provider_skills').upsert(rows, {
      onConflict: 'provider_id,skill_id',
    });
    if (error) throw new BadRequestException({ code: 'SKILLS_SAVE_FAILED', message: error.message });
  }

  private async roleId(code: RoleCode): Promise<string> {
    const { data, error } = await this.supabase.client.from('roles').select('id').eq('code', code).single();
    if (error || !data) {
      throw new BadRequestException({ code: 'ROLE_MISSING', message: `Role ${code} is not seeded.` });
    }
    return data.id as string;
  }

  private async touchLogin(userId: string) {
    await this.supabase.client
      .from('users')
      .update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', userId);
  }
}

function splitName(fullName?: string | null): { first: string | null; last: string | null } {
  if (!fullName?.trim()) return { first: null, last: null };
  const parts = fullName.trim().split(/\s+/);
  return { first: parts[0] ?? null, last: parts.slice(1).join(' ') || null };
}
