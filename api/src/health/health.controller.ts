import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { RedisService } from '../redis/redis.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly redis: RedisService) {}

  // Uptime monitors and load balancers poll this every few seconds from a
  // fixed IP - counting that against the global rate limit would eventually
  // lock the monitor itself out, which defeats the point of a health check.
  @SkipThrottle()
  @Get()
  async check() {
    const redis = await this.redis.ping();
    const status = redis === 'up' ? 'ok' : 'degraded';
    return {
      data: {
        status,
        service: 'solid-connect-api',
        redis,
        timestamp: new Date().toISOString(),
      },
      meta: {},
    };
  }
}
