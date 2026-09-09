import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { assertServiceAreas, type ServiceAreaInput } from './service-areas.util';

export type { ServiceAreaInput };

@Injectable()
export class ProvidersLocationService {
  constructor(private readonly supabase: SupabaseService) {}

  async listServiceAreas(providerId: string) {
    const { data, error } = await this.supabase.client
      .from('provider_service_areas')
      .select('*')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false });
    if (error) throw new BadRequestException({ code: 'AREAS_LIST_FAILED', message: error.message });
    return data ?? [];
  }

  async replaceServiceAreas(providerId: string, areas: ServiceAreaInput[]) {
    assertServiceAreas(areas);

    const { data, error } = await this.supabase.client.rpc('replace_provider_service_areas', {
      p_provider_id: providerId,
      p_areas: areas,
    });
    if (error) throw new BadRequestException({ code: 'AREAS_SAVE_FAILED', message: error.message });

    // Pick up open requests that are now in range with the new coverage.
    await this.supabase.client.rpc('sync_provider_opportunities', {
      p_provider_id: providerId,
    });

    return data ?? [];
  }

  async listAvailability(providerId: string) {
    const [{ data: weekly, error: wErr }, { data: profile, error: pErr }] = await Promise.all([
      this.supabase.client
        .from('provider_availability')
        .select('*')
        .eq('provider_id', providerId)
        .order('day_of_week'),
      this.supabase.client
        .from('profiles')
        .select('availability_mode')
        .eq('id', providerId)
        .maybeSingle(),
    ]);
    if (wErr) throw new BadRequestException({ code: 'AVAIL_LIST_FAILED', message: wErr.message });
    if (pErr) throw new BadRequestException({ code: 'AVAIL_MODE_FAILED', message: pErr.message });
    return {
      mode: profile?.availability_mode ?? 'SCHEDULE',
      weekly: weekly ?? [],
    };
  }

  async setAvailabilityMode(
    providerId: string,
    mode: 'AVAILABLE_NOW' | 'UNAVAILABLE' | 'SCHEDULE' | 'PAUSED',
  ) {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .update({ availability_mode: mode })
      .eq('id', providerId)
      .select('id, availability_mode')
      .single();
    if (error) throw new BadRequestException({ code: 'AVAIL_MODE_SAVE_FAILED', message: error.message });

    // Only sync when the provider just became eligible again - match_providers_for_request
    // already excludes UNAVAILABLE/PAUSED providers, so there's nothing new to pick up
    // when switching into one of those.
    if (mode === 'AVAILABLE_NOW' || mode === 'SCHEDULE') {
      await this.supabase.client.rpc('sync_provider_opportunities', {
        p_provider_id: providerId,
      });
    }

    return data;
  }

  async replaceWeeklyAvailability(
    providerId: string,
    slots: Array<{ dayOfWeek: number; startTime: string; endTime: string; timezone?: string }>,
  ) {
    const { error: delError } = await this.supabase.client
      .from('provider_availability')
      .delete()
      .eq('provider_id', providerId);
    if (delError) throw new BadRequestException({ code: 'AVAIL_CLEAR_FAILED', message: delError.message });

    if (!slots.length) {
      await this.setAvailabilityMode(providerId, 'SCHEDULE');
      return [];
    }
    const rows = slots.map((s) => ({
      provider_id: providerId,
      day_of_week: s.dayOfWeek,
      start_time: s.startTime,
      end_time: s.endTime,
      timezone: s.timezone ?? 'Africa/Accra',
    }));
    const { data, error } = await this.supabase.client.from('provider_availability').insert(rows).select('*');
    if (error) throw new BadRequestException({ code: 'AVAIL_SAVE_FAILED', message: error.message });
    await this.setAvailabilityMode(providerId, 'SCHEDULE');
    return data ?? [];
  }

  async search(input: {
    lng: number;
    lat: number;
    radiusMeters?: number;
    category?: string;
    minVerification?: string;
  }) {
    const { data, error } = await this.supabase.client.rpc('search_providers_geo', {
      p_lng: input.lng,
      p_lat: input.lat,
      p_radius_meters: input.radiusMeters ?? 10000,
      p_category: input.category ?? null,
      p_min_verification: input.minVerification ?? null,
    });
    if (error) throw new BadRequestException({ code: 'SEARCH_FAILED', message: error.message });
    return data ?? [];
  }

  async getVerificationSummary(providerId: string) {
    const { data: profile, error } = await this.supabase.client
      .from('profiles')
      .select('id, verification_level, provider_verified, provider_certified, availability_mode')
      .eq('id', providerId)
      .maybeSingle();
    if (error) throw new BadRequestException({ code: 'VERIFICATION_LOOKUP_FAILED', message: error.message });
    if (!profile) throw new NotFoundException({ code: 'PROVIDER_NOT_FOUND', message: 'Provider not found.' });

    const { data: latest } = await this.supabase.client
      .from('provider_verifications')
      .select('id, status, verification_type, submitted_at, reviewed_at, note')
      .eq('provider_id', providerId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return { profile, latestSubmission: latest ?? null };
  }
}
