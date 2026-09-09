import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RedisService } from '../redis/redis.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly redis: RedisService) {}

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
