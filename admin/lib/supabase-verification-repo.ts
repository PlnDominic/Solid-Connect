import type { SupabaseClient } from '@supabase/supabase-js';
import type { VerificationRecord, VerificationRepo } from './verification-repo';

export class SupabaseVerificationRepo implements VerificationRepo {
  constructor(private client: SupabaseClient) {}

  async getById(id: string): Promise<VerificationRecord | null> {
    const { data, error } = await this.client.from('provider_verifications').select('id, provider_id, status').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { id: data.id, providerId: data.provider_id, status: data.status };
  }

  async markApproved(id: string, adminId: string): Promise<void> {
    const { error } = await this.client
      .from('provider_verifications')
      .update({ status: 'approved', reviewed_by: adminId, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  async markRejected(id: string, adminId: string, note: string): Promise<void> {
    const { error } = await this.client
      .from('provider_verifications')
      .update({ status: 'rejected', reviewed_by: adminId, reviewed_at: new Date().toISOString(), note })
      .eq('id', id);
    if (error) throw error;
  }

  async setProviderVerified(providerId: string): Promise<void> {
    const { error } = await this.client.from('profiles').update({ provider_verified: true }).eq('id', providerId);
    if (error) throw error;
  }
}
