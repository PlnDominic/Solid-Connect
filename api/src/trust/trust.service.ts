import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateDisputeDto, CreateReviewDto } from './dto/trust.dto';
import { disputeWindowOpen } from './trust.rules';

@Injectable()
export class TrustService {
  constructor(private readonly supabase: SupabaseService) {}

  async createReview(customerId: string, dto: CreateReviewDto) {
    const job = await this.job(dto.jobId);
    if (job.customer_id !== customerId) {
      throw new ForbiddenException({ code: 'NOT_JOB_CUSTOMER', message: 'Only the customer can review this job.' });
    }
    if (job.status !== 'completed') {
      throw new BadRequestException({ code: 'JOB_NOT_COMPLETED', message: 'Rate the job after it is completed.' });
    }

    const { data: existing } = await this.supabase.client
      .from('reviews')
      .select('id')
      .eq('job_id', job.id)
      .maybeSingle();
    if (existing) {
      throw new ConflictException({ code: 'REVIEW_EXISTS', message: 'This job already has a review.' });
    }

    const { data, error } = await this.supabase.client
      .from('reviews')
      .insert({
        job_id: job.id,
        provider_id: job.provider_id,
        customer_id: customerId,
        rating: dto.rating,
        comment: dto.comment?.trim() || null,
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException({ code: 'REVIEW_FAILED', message: error.message });

    await this.supabase.client.from('notifications').insert({
      user_id: job.provider_id,
      type: 'REVIEW_RECEIVED',
      title: 'New review',
      body: `You received a ${dto.rating}-star review.`,
      data: { jobId: job.id, reviewId: data.id },
    });

    return data;
  }

  async providerReviews(providerId: string) {
    if (!providerId) {
      throw new BadRequestException({ code: 'PROVIDER_REQUIRED', message: 'providerId is required.' });
    }
    const { data, error } = await this.supabase.client
      .from('reviews')
      .select('id, job_id, provider_id, customer_id, rating, comment, created_at, profiles!reviews_customer_id_fkey(full_name, initials)')
      .eq('provider_id', providerId)
      .is('hidden_at', null)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new BadRequestException({ code: 'REVIEW_LIST_FAILED', message: error.message });
    return data ?? [];
  }

  async createDispute(customerId: string, dto: CreateDisputeDto) {
    const job = await this.job(dto.jobId);
    if (job.customer_id !== customerId) {
      throw new ForbiddenException({ code: 'NOT_JOB_CUSTOMER', message: 'Only the customer can open a dispute on this job.' });
    }
    if (job.status === 'cancelled') {
      throw new BadRequestException({ code: 'JOB_CANCELLED', message: 'Cancelled jobs cannot be disputed.' });
    }
    if (!disputeWindowOpen(job.completed_at)) {
      throw new BadRequestException({
        code: 'DISPUTE_WINDOW_CLOSED',
        message: 'Disputes must be filed within 48 hours of completion.',
      });
    }

    const { data: existing } = await this.supabase.client
      .from('disputes')
      .select('id')
      .eq('job_id', job.id)
      .maybeSingle();
    if (existing) {
      throw new ConflictException({ code: 'DISPUTE_EXISTS', message: 'A dispute is already open on this job.' });
    }

    const { data: dispute, error } = await this.supabase.client
      .from('disputes')
      .insert({
        job_id: job.id,
        customer_id: customerId,
        provider_id: job.provider_id,
        reason: dto.reason,
        description: dto.description.trim(),
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException({ code: 'DISPUTE_FAILED', message: error.message });

    const urls = (dto.evidenceUrls ?? []).slice(0, 4);
    if (urls.length) {
      const { error: evErr } = await this.supabase.client.from('dispute_evidence').insert(
        urls.map((photo_url) => ({ dispute_id: dispute.id, uploaded_by: customerId, photo_url })),
      );
      if (evErr) throw new BadRequestException({ code: 'EVIDENCE_FAILED', message: evErr.message });
    }

    await this.supabase.client.from('notifications').insert({
      user_id: job.provider_id,
      type: 'DISPUTE_OPENED',
      title: 'A dispute was opened',
      body: 'The customer opened a dispute on a job. Solid Connect will review it.',
      data: { jobId: job.id, disputeId: dispute.id },
    });

    return { ...dispute, evidence: urls };
  }

  async jobDispute(jobId: string, userId: string) {
    const job = await this.job(jobId);
    if (job.customer_id !== userId && job.provider_id !== userId) {
      throw new ForbiddenException({ code: 'NOT_JOB_PARTICIPANT', message: 'Not a participant on this job.' });
    }
    const { data, error } = await this.supabase.client
      .from('disputes')
      .select('*, dispute_evidence(id, photo_url, created_at)')
      .eq('job_id', jobId)
      .maybeSingle();
    if (error) throw new BadRequestException({ code: 'DISPUTE_LOOKUP_FAILED', message: error.message });
    return data;
  }

  private async job(jobId: string) {
    const { data, error } = await this.supabase.client
      .from('jobs')
      .select('id, customer_id, provider_id, status, completed_at')
      .eq('id', jobId)
      .maybeSingle();
    if (error) throw new BadRequestException({ code: 'JOB_LOOKUP_FAILED', message: error.message });
    if (!data) throw new NotFoundException({ code: 'JOB_NOT_FOUND', message: 'Job not found.' });
    return data;
  }
}
