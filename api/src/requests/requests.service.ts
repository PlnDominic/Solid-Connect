import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateRequestDto } from './dto/requests.dto';

@Injectable()
export class RequestsService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(customerId: string, dto: CreateRequestDto) {
    const { data: category, error: catErr } = await this.supabase.client
      .from('categories')
      .select('id, budget_min, budget_max, default_label')
      .eq('id', dto.categoryId)
      .maybeSingle();
    if (catErr) {
      throw new BadRequestException({ code: 'CATEGORY_LOOKUP_FAILED', message: catErr.message });
    }
    if (!category) {
      throw new BadRequestException({ code: 'CATEGORY_NOT_FOUND', message: 'Unknown service category.' });
    }

    const bandMin = category.budget_min ?? 0;
    const bandMax = category.budget_max ?? 999999;
    const stated =
      dto.budget ??
      (dto.budgetMin != null && dto.budgetMax != null && dto.budgetMin === dto.budgetMax
        ? dto.budgetMin
        : dto.budgetMin != null && dto.budgetMax != null
          ? Math.round((dto.budgetMin + dto.budgetMax) / 2)
          : dto.budgetMin ?? dto.budgetMax);

    if (stated == null || stated < 1) {
      throw new BadRequestException({
        code: 'BUDGET_REQUIRED',
        message: 'Enter a budget for this request.',
      });
    }
    if (stated < bandMin || stated > bandMax) {
      throw new BadRequestException({
        code: 'BUDGET_OUT_OF_RANGE',
        message: `Budget must be between GHS ${bandMin} and GHS ${bandMax} for this service.`,
      });
    }

    const isDirect = Boolean(dto.preferredProviderId);

    if (isDirect) {
      if (dto.preferredProviderId === customerId) {
        throw new BadRequestException({
          code: 'INVALID_PROVIDER',
          message: 'You cannot send a direct request to yourself.',
        });
      }
      const { data: provider, error: pErr } = await this.supabase.client
        .from('profiles')
        .select('id, role, provider_category, availability_mode')
        .eq('id', dto.preferredProviderId!)
        .maybeSingle();
      if (pErr) {
        throw new BadRequestException({ code: 'PROVIDER_LOOKUP_FAILED', message: pErr.message });
      }
      const looksLikeProvider =
        !!provider && (provider.role === 'provider' || !!provider.provider_category);
      if (!looksLikeProvider) {
        throw new BadRequestException({
          code: 'PROVIDER_NOT_FOUND',
          message: 'Preferred provider was not found.',
        });
      }
      if (provider!.availability_mode === 'UNAVAILABLE' || provider!.availability_mode === 'PAUSED') {
        throw new BadRequestException({
          code: 'PROVIDER_UNAVAILABLE',
          message: 'That provider is not currently available.',
        });
      }
    }

    const locationLabel = dto.locationLabel.includes('Accra')
      ? dto.locationLabel
      : `${dto.locationLabel}, Accra`;

    const { data: request, error } = await this.supabase.client
      .from('service_requests')
      .insert({
        customer_id: customerId,
        category_id: dto.categoryId,
        category_label: dto.categoryLabel || category.default_label,
        description: dto.description,
        photos: dto.photos ?? [],
        budget_min: stated,
        budget_max: stated,
        customer_budget: stated,
        location_label: locationLabel,
        match_radius_meters: dto.matchRadiusMeters ?? 10000,
        preferred_provider_id: dto.preferredProviderId ?? null,
        request_mode: isDirect ? 'DIRECT' : 'GENERAL',
        status: isDirect ? 'awaiting_provider' : 'matching',
      })
      .select('*')
      .single();

    if (error) {
      throw new BadRequestException({ code: 'REQUEST_CREATE_FAILED', message: error.message });
    }

    await this.supabase.client.rpc('set_request_location_from_label', { p_request_id: request.id });

    const opportunities = isDirect
      ? await this.assignDirectProvider(request.id, dto.preferredProviderId!)
      : await this.runMatching(request.id);

    const { data: refreshed } = await this.supabase.client
      .from('service_requests')
      .select('*')
      .eq('id', request.id)
      .single();

    return { request: refreshed ?? request, opportunities, matchedCount: opportunities.length };
  }

  /** Direct hire: notify only the chosen provider (no open matching). */
  async assignDirectProvider(requestId: string, providerId: string) {
    await this.supabase.client.from('request_opportunities').delete().eq('request_id', requestId);

    const row = {
      request_id: requestId,
      provider_id: providerId,
      score: 100,
      distance_meters: null as number | null,
      status: 'NOTIFIED',
    };

    const { error: insErr } = await this.supabase.client.from('request_opportunities').insert(row);
    if (insErr) {
      throw new BadRequestException({ code: 'OPPORTUNITY_SAVE_FAILED', message: insErr.message });
    }

    await this.supabase.client
      .from('service_requests')
      .update({ matched_at: new Date().toISOString(), status: 'awaiting_provider' })
      .eq('id', requestId);

    return [row];
  }

  async runMatching(requestId: string, limit = 20) {
    const { data: existing } = await this.supabase.client
      .from('service_requests')
      .select('preferred_provider_id, request_mode')
      .eq('id', requestId)
      .maybeSingle();

    if (existing?.preferred_provider_id || existing?.request_mode === 'DIRECT') {
      if (!existing.preferred_provider_id) {
        throw new BadRequestException({
          code: 'DIRECT_MISSING_PROVIDER',
          message: 'Direct request has no preferred provider.',
        });
      }
      return this.assignDirectProvider(requestId, existing.preferred_provider_id);
    }

    const { data: matches, error } = await this.supabase.client.rpc('match_providers_for_request', {
      p_request_id: requestId,
      p_limit: limit,
    });
    if (error) {
      throw new BadRequestException({ code: 'MATCH_FAILED', message: error.message });
    }

    await this.supabase.client.from('request_opportunities').delete().eq('request_id', requestId);

    const rows = (matches ?? []).map(
      (m: { provider_id: string; score: number; distance_meters: number | null }) => ({
        request_id: requestId,
        provider_id: m.provider_id,
        score: m.score,
        distance_meters: m.distance_meters,
        status: 'NOTIFIED',
      }),
    );

    if (rows.length) {
      const { error: insErr } = await this.supabase.client.from('request_opportunities').insert(rows);
      if (insErr) {
        throw new BadRequestException({ code: 'OPPORTUNITY_SAVE_FAILED', message: insErr.message });
      }
    }

    await this.supabase.client
      .from('service_requests')
      .update({ matched_at: new Date().toISOString(), status: 'matching' })
      .eq('id', requestId);

    return rows;
  }

  async acceptDirect(requestId: string, providerId: string) {
    const { data, error } = await this.supabase.client.rpc('accept_direct_request', {
      p_request_id: requestId,
      p_provider_id: providerId,
    });
    if (error) {
      const msg = error.message ?? 'Accept failed';
      if (msg.includes('NOT_DIRECT_PROVIDER')) {
        throw new ForbiddenException({ code: 'NOT_DIRECT_PROVIDER', message: 'Not your direct request.' });
      }
      if (msg.includes('REQUEST_NOT_AWAITING')) {
        throw new BadRequestException({
          code: 'REQUEST_NOT_AWAITING',
          message: 'This request is no longer awaiting a response.',
        });
      }
      throw new BadRequestException({ code: 'ACCEPT_DIRECT_FAILED', message: msg });
    }
    return data;
  }

  async rejectDirect(requestId: string, providerId: string, reason: string) {
    const { data, error } = await this.supabase.client.rpc('reject_direct_request', {
      p_request_id: requestId,
      p_provider_id: providerId,
      p_reason: reason,
    });
    if (error) {
      const msg = error.message ?? 'Reject failed';
      if (msg.includes('NOT_DIRECT_PROVIDER')) {
        throw new ForbiddenException({ code: 'NOT_DIRECT_PROVIDER', message: 'Not your direct request.' });
      }
      if (msg.includes('REASON_REQUIRED')) {
        throw new BadRequestException({
          code: 'REASON_REQUIRED',
          message: 'Please provide a short reason for declining.',
        });
      }
      if (msg.includes('REQUEST_NOT_AWAITING')) {
        throw new BadRequestException({
          code: 'REQUEST_NOT_AWAITING',
          message: 'This request is no longer awaiting a response.',
        });
      }
      throw new BadRequestException({ code: 'REJECT_DIRECT_FAILED', message: msg });
    }
    return data;
  }

  async listNotifications(userId: string) {
    const { data, error } = await this.supabase.client
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(40);
    if (error) {
      throw new BadRequestException({ code: 'NOTIFICATIONS_FAILED', message: error.message });
    }
    return data ?? [];
  }

  async markNotificationRead(userId: string, notificationId: string) {
    const { error } = await this.supabase.client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', userId);
    if (error) {
      throw new BadRequestException({ code: 'NOTIFICATION_UPDATE_FAILED', message: error.message });
    }
    return { ok: true };
  }

  async getRequest(requestId: string, userId: string) {
    const { data, error } = await this.supabase.client
      .from('service_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();
    if (error) throw new BadRequestException({ code: 'REQUEST_LOOKUP_FAILED', message: error.message });
    if (!data) throw new NotFoundException({ code: 'REQUEST_NOT_FOUND', message: 'Request not found.' });

    const isOwner = data.customer_id === userId;
    if (!isOwner) {
      const { data: opp } = await this.supabase.client
        .from('request_opportunities')
        .select('id')
        .eq('request_id', requestId)
        .eq('provider_id', userId)
        .maybeSingle();
      if (!opp && data.preferred_provider_id !== userId) {
        throw new ForbiddenException({
          code: 'REQUEST_FORBIDDEN',
          message: 'Not allowed to view this request.',
        });
      }
    }
    return data;
  }

  async listMine(customerId: string) {
    const { data, error } = await this.supabase.client
      .from('service_requests')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new BadRequestException({ code: 'REQUEST_LIST_FAILED', message: error.message });
    return data ?? [];
  }

  async listOpportunities(requestId: string, customerId: string) {
    const request = await this.getRequest(requestId, customerId);
    if (request.customer_id !== customerId) {
      throw new ForbiddenException({
        code: 'REQUEST_FORBIDDEN',
        message: 'Only the customer can list matches.',
      });
    }
    const { data, error } = await this.supabase.client
      .from('request_opportunities')
      .select(
        '*, profiles:provider_id(id, full_name, initials, area, photo_url, provider_category, provider_rating, provider_verified, provider_certified, verification_level)',
      )
      .eq('request_id', requestId)
      .order('score', { ascending: false });
    if (error) throw new BadRequestException({ code: 'OPP_LIST_FAILED', message: error.message });
    return data ?? [];
  }

  async providerFeed(providerId: string) {
    // Opportunities are synced when a provider's categories/areas/availability
    // actually change (see setProviderCategories, replaceServiceAreas,
    // setAvailabilityMode) rather than on every feed read - re-running the
    // full match_providers_for_request scan here on each load/pull-to-refresh
    // multiplied cost for no benefit, since nothing relevant changes between
    // reads.
    const { data, error } = await this.supabase.client
      .from('request_opportunities')
      .select(
        'id, score, distance_meters, status, created_at, request:request_id(id, category_label, description, photos, budget_min, budget_max, customer_budget, location_label, status, created_at, customer_id, request_mode, preferred_provider_id, rejection_reason)',
      )
      .eq('provider_id', providerId)
      .in('status', ['NOTIFIED', 'VIEWED', 'QUOTED'])
      .order('created_at', { ascending: false })
      .limit(40);
    if (error) throw new BadRequestException({ code: 'FEED_FAILED', message: error.message });

    type FeedRow = {
      id: string;
      score: number;
      distance_meters: number | null;
      status: string;
      created_at: string;
      request: {
        id: string;
        category_label: string;
        description: string;
        photos: string[];
        budget_min: number | null;
        budget_max: number | null;
        customer_budget?: number | null;
        location_label: string;
        status: string;
        created_at: string;
        customer_id: string;
        request_mode?: string;
        preferred_provider_id?: string | null;
      } | null;
    };

    const rows = (data ?? []) as unknown as FeedRow[];
    const requestIds = rows.map((r) => r.request?.id).filter(Boolean) as string[];

    let myQuotes: Array<{ request_id: string; id: string; price: number }> = [];
    if (requestIds.length) {
      const { data: quotes } = await this.supabase.client
        .from('quotes')
        .select('id, request_id, price')
        .eq('provider_id', providerId)
        .in('request_id', requestIds);
      myQuotes = quotes ?? [];
    }
    const quoteByRequest = new Map(myQuotes.map((q) => [q.request_id, q]));

    return rows
      .filter((r) => {
        const status = r.request?.status;
        return (
          status === 'open' ||
          status === 'matching' ||
          status === 'quoted' ||
          status === 'awaiting_provider'
        );
      })
      .map((r) => ({
        ...r,
        myQuote: r.request?.id ? quoteByRequest.get(r.request.id) ?? null : null,
      }));
  }
}
