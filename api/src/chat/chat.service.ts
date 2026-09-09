import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateThreadDto, SendMessageDto } from './dto/chat.dto';

@Injectable()
export class ChatService {
  constructor(private readonly supabase: SupabaseService) {}

  async listThreads(userId: string, role: 'customer' | 'provider') {
    const column = role === 'customer' ? 'customer_id' : 'provider_id';
    const { data, error } = await this.supabase.client
      .from('chat_threads')
      .select('*')
      .eq(column, userId)
      .order('created_at', { ascending: false });
    if (error) throw new BadRequestException({ code: 'THREAD_LIST_FAILED', message: error.message });
    return data ?? [];
  }

  async getThread(threadId: string, userId: string) {
    const { data, error } = await this.supabase.client
      .from('chat_threads')
      .select('*')
      .eq('id', threadId)
      .maybeSingle();
    if (error) throw new BadRequestException({ code: 'THREAD_LOOKUP_FAILED', message: error.message });
    if (!data) throw new NotFoundException({ code: 'THREAD_NOT_FOUND', message: 'Thread not found.' });
    if (data.customer_id !== userId && data.provider_id !== userId) {
      throw new ForbiddenException({ code: 'NOT_THREAD_PARTICIPANT', message: 'Not a participant.' });
    }
    return data;
  }

  async ensureThread(userId: string, dto: CreateThreadDto) {
    const customerId = dto.asRole === 'customer' ? userId : dto.peerId;
    const providerId = dto.asRole === 'provider' ? userId : dto.peerId;

    if (dto.requestId) {
      const { data: existing } = await this.supabase.client
        .from('chat_threads')
        .select('*')
        .eq('request_id', dto.requestId)
        .eq('provider_id', providerId)
        .maybeSingle();
      if (existing) {
        if (existing.customer_id !== customerId) {
          throw new ForbiddenException({ code: 'THREAD_MISMATCH', message: 'Thread participants mismatch.' });
        }
        return existing;
      }
    }

    const { data, error } = await this.supabase.client
      .from('chat_threads')
      .insert({
        request_id: dto.requestId ?? null,
        job_id: dto.jobId ?? null,
        customer_id: customerId,
        provider_id: providerId,
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException({ code: 'THREAD_CREATE_FAILED', message: error.message });
    return data;
  }

  async listMessages(threadId: string, userId: string) {
    await this.getThread(threadId, userId);
    const { data, error } = await this.supabase.client
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    if (error) throw new BadRequestException({ code: 'MESSAGE_LIST_FAILED', message: error.message });
    return data ?? [];
  }

  async sendMessage(threadId: string, userId: string, dto: SendMessageDto) {
    const thread = await this.getThread(threadId, userId);
    const senderRole = thread.customer_id === userId ? 'customer' : 'provider';
    const text = dto.text.trim();
    if (!text) throw new BadRequestException({ code: 'EMPTY_MESSAGE', message: 'Message text is required.' });

    const { data, error } = await this.supabase.client
      .from('chat_messages')
      .insert({
        thread_id: threadId,
        sender_id: userId,
        sender_role: senderRole,
        text,
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException({ code: 'MESSAGE_SEND_FAILED', message: error.message });
    return data;
  }
}
