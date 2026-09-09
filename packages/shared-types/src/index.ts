/**
 * Shared marketplace types. Keep in sync with supabase migrations and NestJS DTOs.
 * Phase A: minimal surface. Expand in later phases.
 */

export type RoleCode =
  | 'CUSTOMER'
  | 'PROVIDER'
  | 'PROFESSIONAL'
  | 'ORGANIZATION_MEMBER'
  | 'ADMIN'
  | 'SUPER_ADMIN';

export type UserStatus = 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'DISABLED';

export interface AuthUser {
  id: string;
  email?: string | null;
  phone?: string | null;
  roles: RoleCode[];
  status: UserStatus;
}

export const API_PREFIX = 'api/v1';
