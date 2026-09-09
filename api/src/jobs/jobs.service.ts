import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class JobsService {
  constructor(private readonly supabase: SupabaseService) {}

  private assertParticipant(job: { customer_id: string; provider_id: string }, userId: string) {
    if (job.customer_id !== userId && job.provider_id !== userId) {
      throw new ForbiddenException({ code: 'NOT_JOB_PARTICIPANT', message: 'Not a participant on this job.' });
    }
  }

  async getJob(jobId: string, userId: string) {
    const { data, error } = await this.supabase.client.from('jobs').select('*').eq('id', jobId).maybeSingle();
    if (error) throw new BadRequestException({ code: 'JOB_LOOKUP_FAILED', message: error.message });
    if (!data) throw new NotFoundException({ code: 'JOB_NOT_FOUND', message: 'Job not found.' });
    this.assertParticipant(data, userId);
    return data;
  }

  async listMine(userId: string, roleHint?: 'customer' | 'provider') {
    let q = this.supabase.client.from('jobs').select('*').order('started_at', { ascending: false }).limit(50);
    if (roleHint === 'provider') q = q.eq('provider_id', userId);
    else if (roleHint === 'customer') q = q.eq('customer_id', userId);
    else q = q.or(`customer_id.eq.${userId},provider_id.eq.${userId}`);
    const { data, error } = await q;
    if (error) throw new BadRequestException({ code: 'JOB_LIST_FAILED', message: error.message });
    return data ?? [];
  }

  async listEvents(jobId: string, userId: string) {
    await this.getJob(jobId, userId);
    const { data, error } = await this.supabase.client
      .from('job_events')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });
    if (error) throw new BadRequestException({ code: 'JOB_EVENTS_FAILED', message: error.message });
    return data ?? [];
  }

  private mapProviderRpcError(error: { message?: string }) {
    const msg = error.message ?? '';
    if (msg.includes('JOB_NOT_FOUND')) throw new NotFoundException({ code: 'JOB_NOT_FOUND', message: 'Job not found.' });
    if (msg.includes('NOT_JOB_PROVIDER')) {
      throw new ForbiddenException({ code: 'NOT_JOB_PROVIDER', message: 'Only the assigned provider can do this.' });
    }
    if (msg.includes('JOB_ALREADY_COMPLETED')) {
      throw new BadRequestException({ code: 'JOB_ALREADY_COMPLETED', message: 'Job is already completed.' });
    }
    if (msg.includes('JOB_AWAITING_CUSTOMER')) {
      throw new BadRequestException({
        code: 'JOB_AWAITING_CUSTOMER',
        message: 'Waiting for the customer to confirm completion.',
      });
    }
    if (msg.includes('JOB_NOT_STARTABLE')) {
      throw new BadRequestException({ code: 'JOB_NOT_STARTABLE', message: 'This job cannot be started.' });
    }
    if (msg.includes('JOB_NOT_IN_PROGRESS')) {
      throw new BadRequestException({
        code: 'JOB_NOT_IN_PROGRESS',
        message: 'Start the job before marking it finished.',
      });
    }
    throw new BadRequestException({ code: 'JOB_ACTION_FAILED', message: error.message });
  }

  async start(jobId: string, providerId: string) {
    const { data, error } = await this.supabase.client.rpc('start_job', {
      p_job_id: jobId,
      p_provider_id: providerId,
    });
    if (error) this.mapProviderRpcError(error);
    return data;
  }

  async finish(jobId: string, providerId: string) {
    const { data, error } = await this.supabase.client.rpc('finish_job', {
      p_job_id: jobId,
      p_provider_id: providerId,
    });
    if (error) this.mapProviderRpcError(error);
    return data;
  }

  /** @deprecated Prefer start/finish — kept for older clients. */
  async advance(jobId: string, providerId: string) {
    const { data, error } = await this.supabase.client.rpc('advance_job', {
      p_job_id: jobId,
      p_provider_id: providerId,
    });
    if (error) this.mapProviderRpcError(error);
    return data;
  }

  async confirm(jobId: string, customerId: string) {
    const { data, error } = await this.supabase.client.rpc('confirm_job_completion', {
      p_job_id: jobId,
      p_customer_id: customerId,
    });
    if (error) {
      const msg = error.message ?? '';
      if (msg.includes('JOB_NOT_FOUND')) throw new NotFoundException({ code: 'JOB_NOT_FOUND', message: 'Job not found.' });
      if (msg.includes('NOT_JOB_CUSTOMER')) {
        throw new ForbiddenException({ code: 'NOT_JOB_CUSTOMER', message: 'Only the customer can confirm completion.' });
      }
      if (msg.includes('JOB_NOT_READY')) {
        throw new BadRequestException({
          code: 'JOB_NOT_READY',
          message: 'Provider has not marked the job finished yet.',
        });
      }
      throw new BadRequestException({ code: 'CONFIRM_FAILED', message: error.message });
    }
    return data as { job: Record<string, unknown>; payment: Record<string, unknown> };
  }
}
