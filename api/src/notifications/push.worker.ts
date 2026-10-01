import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PushService } from './push.service';

const DRAIN_MS = 15_000;

@Injectable()
export class PushWorker implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private ticks = 0;

  constructor(private readonly push: PushService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.tick(), DRAIN_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    this.ticks += 1;
    try {
      await this.push.drainOutbox();
      if (this.ticks % 4 === 0) await this.push.checkReceipts();
    } catch {
      // A failed sweep retries on the next tick. Notification rows are already saved.
    } finally {
      this.running = false;
    }
  }
}
