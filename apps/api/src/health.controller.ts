import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from './auth/access.decorator';
import { PrismaService } from './common/prisma.service';
import { RedisService } from './common/redis.service';
@Controller('health')
export class HealthController {
  constructor(private readonly db: PrismaService, private readonly redis: RedisService) {}
  @Get() @Public() async health() {
    try { await this.db.$queryRaw`SELECT 1`; const redis = await this.redis.client.ping(); return { status: 'ok', database: 'connected', redis: redis === 'PONG' ? 'connected' : 'unavailable' }; }
    catch { throw new ServiceUnavailableException('Database or Redis unavailable'); }
  }
}
