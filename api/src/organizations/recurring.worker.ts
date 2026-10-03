import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';

const TICK_MS = 60_000;

@Injectable()
export class RecurringWorker implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly organizations: OrganizationsService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.organizations.processDueRecurring();
    } catch {
      // Retry next minute.
    } finally {
      this.running = false;
    }
  }
}
