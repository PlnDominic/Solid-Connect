import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { isDeadPushToken, isExpoPushToken, pushDeepLink, pushEnabled, ticketOutcome, type ExpoTicket } from './push.rules';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

type OutboxRow = { id: string; notification_id: string; user_id: string };
type NotificationRow = { id: string; type: string; title: string; body: string; data: Record<string, unknown> | null };
type ProfileRow = { id: string; push_token: string | null; notification_prefs: Record<string, unknown> | null };

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  async drainOutbox(): Promise<number> {
    await this.releaseStaleClaims();
    const { data: pending, error } = await this.supabase.client
      .from('push_outbox')
      .select('id, notification_id, user_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(40);
    if (error || !pending?.length) return 0;

    const ids = pending.map((row) => row.id);
    const { data: claimed } = await this.supabase.client
      .from('push_outbox')
      .update({ status: 'sending' })
      .in('id', ids)
      .eq('status', 'pending')
      .select('id, notification_id, user_id');
    const rows = (claimed ?? []) as OutboxRow[];
    if (!rows.length) return 0;

    const notificationIds = rows.map((row) => row.notification_id);
    const userIds = [...new Set(rows.map((row) => row.user_id))];
    const [{ data: notifications }, { data: profiles }] = await Promise.all([
      this.supabase.client.from('notifications').select('id, type, title, body, data').in('id', notificationIds),
      this.supabase.client.from('profiles').select('id, push_token, notification_prefs').in('id', userIds),
    ]);
    const byNotification = new Map((notifications as NotificationRow[] | null)?.map((row) => [row.id, row]) ?? []);
    const byProfile = new Map((profiles as ProfileRow[] | null)?.map((row) => [row.id, row]) ?? []);

    const toSend: { row: OutboxRow; token: string; message: Record<string, unknown> }[] = [];
    for (const row of rows) {
      const notification = byNotification.get(row.notification_id);
      const profile = byProfile.get(row.user_id);
      const token = profile?.push_token ?? null;
      if (!notification || !isExpoPushToken(token) || !pushEnabled(profile?.notification_prefs, notification.type)) {
        await this.supabase.client
          .from('push_outbox')
          .update({ status: 'skipped', error: !isExpoPushToken(token) ? 'NO_TOKEN' : 'PREF_OFF' })
          .eq('id', row.id);
        continue;
      }
      const data = notification.data ?? {};
      toSend.push({
        row,
        token: token as string,
        message: {
          to: token,
          title: notification.title,
          body: notification.body,
          sound: 'default',
          channelId: 'default',
          data: {
            ...data,
            notificationId: notification.id,
            type: notification.type,
            url: pushDeepLink(data),
          },
        },
      });
    }

    if (!toSend.length) return rows.length;

    let tickets: ExpoTicket[] = [];
    try {
      tickets = await this.postExpo(EXPO_PUSH_URL, toSend.map((item) => item.message));
    } catch (err) {
      this.logger.warn(`Expo push send failed: ${err instanceof Error ? err.message : 'unknown'}`);
      await this.supabase.client
        .from('push_outbox')
        .update({ status: 'pending' })
        .in(
          'id',
          toSend.map((item) => item.row.id),
        );
      return rows.length - toSend.length;
    }

    for (let i = 0; i < toSend.length; i += 1) {
      const item = toSend[i];
      const outcome = ticketOutcome(tickets[i]);
      if (outcome.ok) {
        await this.supabase.client
          .from('push_outbox')
          .update({
            status: 'sent',
            ticket_id: outcome.ticketId,
            push_token: item.token,
            sent_at: new Date().toISOString(),
            error: null,
          })
          .eq('id', item.row.id);
      } else {
        await this.supabase.client
          .from('push_outbox')
          .update({ status: 'failed', error: outcome.error, push_token: item.token })
          .eq('id', item.row.id);
        if (isDeadPushToken(outcome.error)) await this.clearToken(item.row.user_id, item.token);
      }
    }
    return rows.length;
  }

  async checkReceipts(): Promise<number> {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data, error } = await this.supabase.client
      .from('push_outbox')
      .select('id, user_id, ticket_id, push_token')
      .eq('status', 'sent')
      .is('receipt_checked_at', null)
      .lt('sent_at', cutoff)
      .limit(80);
    if (error || !data?.length) return 0;

    const rows = data as { id: string; user_id: string; ticket_id: string; push_token: string | null }[];
    let receipts: Record<string, ExpoTicket> = {};
    try {
      const body = await this.postExpoRaw(EXPO_RECEIPTS_URL, { ids: rows.map((row) => row.ticket_id) });
      receipts = (body?.data ?? {}) as Record<string, ExpoTicket>;
    } catch (err) {
      this.logger.warn(`Expo receipt check failed: ${err instanceof Error ? err.message : 'unknown'}`);
      return 0;
    }

    const checkedAt = new Date().toISOString();
    for (const row of rows) {
      const receipt = receipts[row.ticket_id];
      const dead = receipt?.status === 'error' && isDeadPushToken(receipt.details?.error);
      await this.supabase.client
        .from('push_outbox')
        .update({
          receipt_checked_at: checkedAt,
          error: dead ? 'DeviceNotRegistered' : row && receipt?.status === 'error' ? receipt.details?.error || receipt.message : null,
        })
        .eq('id', row.id);
      if (dead && row.push_token) await this.clearToken(row.user_id, row.push_token);
    }
    return rows.length;
  }

  private async releaseStaleClaims() {
    const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    await this.supabase.client.from('push_outbox').update({ status: 'pending' }).eq('status', 'sending').lt('created_at', cutoff);
  }

  private async clearToken(userId: string, token: string) {
    await this.supabase.client.from('profiles').update({ push_token: null }).eq('id', userId).eq('push_token', token);
  }

  private async postExpo(url: string, messages: Record<string, unknown>[]): Promise<ExpoTicket[]> {
    const body = await this.postExpoRaw(url, messages);
    return (body?.data ?? []) as ExpoTicket[];
  }

  private async postExpoRaw(url: string, payload: unknown): Promise<{ data?: unknown } | null> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const accessToken = this.config.get<string>('expo.accessToken');
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Expo HTTP ${res.status}`);
    return (await res.json()) as { data?: unknown };
  }
}
