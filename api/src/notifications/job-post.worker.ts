import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

const SWEEP_MS = 5 * 60_000;

/**
 * Every few minutes asks the database to warn customers whose job post
 * expires within a day, and to tell the customer and the interested
 * providers once a post has expired (see sweep_job_posts() in 0084). Each
 * notice is sent once; the notification rows then go out as pushes through
 * the normal push outbox.
 */
@Injectable()
export class JobPostWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobPostWorker.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly supabase: SupabaseService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.tick(), SWEEP_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const { error } = await this.supabase.client.rpc('sweep_job_posts');
      if (error) this.logger.warn(`Job post sweep failed: ${error.message}`);
    } catch (err) {
      this.logger.warn(`Job post sweep failed: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      this.running = false;
    }
  }
}
