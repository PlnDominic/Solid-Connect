import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { AcceptQuoteDto, CreateQuoteDto, ReviseQuoteDto } from './dto/quotes.dto';

@Injectable()
export class QuotesService {
  constructor(private readonly supabase: SupabaseService) {}

  private badgeFor(profile: {
    provider_certified?: boolean | null;
    provider_verified?: boolean | null;
  }) {
    if (profile.provider_certified) {
      return { badge_label: 'Certified', badge_kind: 'certified' as const };
    }
    return { badge_label: 'Identity verified', badge_kind: 'verified' as const };
  }

  async create(providerId: string, dto: CreateQuoteDto) {
    const { data: request, error: rErr } = await this.supabase.client
      .from('service_requests')
      .select('*')
      .eq('id', dto.requestId)
      .maybeSingle();
    if (rErr) throw new BadRequestException({ code: 'REQUEST_LOOKUP_FAILED', message: rErr.message });
    if (!request) throw new NotFoundException({ code: 'REQUEST_NOT_FOUND', message: 'Request not found.' });
    if (!['open', 'matching', 'quoted'].includes(request.status)) {
      throw new ConflictException({ code: 'REQUEST_CLOSED', message: 'This request is no longer accepting quotes.' });
    }
    if (request.customer_id === providerId) {
      throw new ForbiddenException({ code: 'CANNOT_QUOTE_OWN', message: 'You cannot quote your own request.' });
    }
    if (request.preferred_provider_id && request.preferred_provider_id !== providerId) {
      throw new ForbiddenException({
        code: 'DIRECT_REQUEST_ONLY',
        message: 'This request was sent to another provider.',
      });
    }

    const { data: opportunity } = await this.supabase.client
      .from('request_opportunities')
      .select('id')
      .eq('request_id', dto.requestId)
      .eq('provider_id', providerId)
      .maybeSingle();

    // Soft allow if opportunities table empty for legacy requests
    if (!opportunity) {
      const { count } = await this.supabase.client
        .from('request_opportunities')
        .select('id', { count: 'exact', head: true })
        .eq('request_id', dto.requestId);
      if ((count ?? 0) > 0) {
        throw new ForbiddenException({
          code: 'NOT_ELIGIBLE',
          message: 'You were not matched to this request.',
        });
      }
    }

    const { data: profile } = await this.supabase.client
      .from('profiles')
      .select('provider_certified, provider_verified, availability_mode')
      .eq('id', providerId)
      .maybeSingle();
    if (!profile || profile.availability_mode === 'UNAVAILABLE' || profile.availability_mode === 'PAUSED') {
      throw new ForbiddenException({ code: 'PROVIDER_UNAVAILABLE', message: 'Set availability before quoting.' });
    }

    const badge = this.badgeFor(profile);
    const { data: existing } = await this.supabase.client
      .from('quotes')
      .select('*')
      .eq('request_id', dto.requestId)
      .eq('provider_id', providerId)
      .maybeSingle();

    if (existing) {
      if (existing.status !== 'sent') {
        throw new ConflictException({ code: 'QUOTE_LOCKED', message: 'This quote can no longer be changed.' });
      }
      return this.revise(providerId, existing.id, {
        price: dto.price,
        etaLabel: dto.etaLabel,
        note: dto.note,
      });
    }

    const { data: quote, error } = await this.supabase.client
      .from('quotes')
      .insert({
        request_id: dto.requestId,
        provider_id: providerId,
        price: dto.price,
        eta_label: dto.etaLabel ?? 'Today, 2 hrs',
        note: dto.note ?? '',
        revision: 1,
        ...badge,
        status: 'sent',
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException({ code: 'QUOTE_CREATE_FAILED', message: error.message });

    await this.supabase.client
      .from('service_requests')
      .update({ status: 'quoted' })
      .eq('id', dto.requestId)
      .in('status', ['open', 'matching']);

    await this.supabase.client
      .from('request_opportunities')
      .update({ status: 'QUOTED' })
      .eq('request_id', dto.requestId)
      .eq('provider_id', providerId);

    return quote;
  }

  async revise(providerId: string, quoteId: string, dto: ReviseQuoteDto) {
    const { data: quote, error } = await this.supabase.client
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .maybeSingle();
    if (error) throw new BadRequestException({ code: 'QUOTE_LOOKUP_FAILED', message: error.message });
    if (!quote) throw new NotFoundException({ code: 'QUOTE_NOT_FOUND', message: 'Quote not found.' });
    if (quote.provider_id !== providerId) {
      throw new ForbiddenException({ code: 'NOT_QUOTE_OWNER', message: 'Not your quote.' });
    }
    if (quote.status !== 'sent') {
      throw new ConflictException({ code: 'QUOTE_LOCKED', message: 'Only open quotes can be revised.' });
    }

    const { data: updated, error: uErr } = await this.supabase.client
      .from('quotes')
      .update({
        price: dto.price,
        eta_label: dto.etaLabel ?? quote.eta_label,
        note: dto.note ?? quote.note ?? '',
        revision: (quote.revision ?? 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId)
      .select('*')
      .single();
    if (uErr) throw new BadRequestException({ code: 'QUOTE_REVISE_FAILED', message: uErr.message });
    return updated;
  }

  async listForRequest(requestId: string, userId: string) {
    const { data: request, error } = await this.supabase.client
      .from('service_requests')
      .select('id, customer_id')
      .eq('id', requestId)
      .maybeSingle();
    if (error) throw new BadRequestException({ code: 'REQUEST_LOOKUP_FAILED', message: error.message });
    if (!request) throw new NotFoundException({ code: 'REQUEST_NOT_FOUND', message: 'Request not found.' });

    const isCustomer = request.customer_id === userId;
    let query = this.supabase.client
      .from('quotes')
      .select(
        '*, profiles:provider_id(id, full_name, initials, photo_url, provider_rating, provider_verified, provider_certified, verification_level, area)',
      )
      .eq('request_id', requestId)
      .order('price', { ascending: true });

    if (!isCustomer) {
      query = query.eq('provider_id', userId);
    }

    const { data, error: qErr } = await query;
    if (qErr) throw new BadRequestException({ code: 'QUOTE_LIST_FAILED', message: qErr.message });
    return data ?? [];
  }

  async accept(customerId: string, dto: AcceptQuoteDto) {
    const { data, error } = await this.supabase.client.rpc('accept_quote', {
      p_quote_id: dto.quoteId,
      p_customer_id: customerId,
    });
    if (error) {
      const msg = error.message ?? '';
      if (msg.includes('QUOTE_NOT_FOUND')) {
        throw new NotFoundException({ code: 'QUOTE_NOT_FOUND', message: 'Quote not found.' });
      }
      if (msg.includes('NOT_REQUEST_OWNER')) {
        throw new ForbiddenException({ code: 'NOT_REQUEST_OWNER', message: 'Only the customer can accept.' });
      }
      if (msg.includes('QUOTE_NOT_OPEN') || msg.includes('REQUEST_NOT_ACCEPTABLE')) {
        throw new ConflictException({ code: 'ACCEPT_CONFLICT', message: 'Quote cannot be accepted in its current state.' });
      }
      throw new BadRequestException({ code: 'ACCEPT_FAILED', message: error.message });
    }
    return data as { job: Record<string, unknown>; quote: Record<string, unknown> };
  }
}
