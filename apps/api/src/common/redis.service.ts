import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);
  constructor() {
    this.client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 1,
      connectTimeout: 2500,
      retryStrategy: (attempt) => Math.min(attempt * 500, 3000),
    });
    this.client.on('error', () => this.logger.warn('Redis unavailable; using database for authentication checks.'));
  }
  async get(key: string): Promise<string | null> { try { return await this.client.get(key); } catch { return null; } }
  async set(key: string, value: string, ttlSeconds: number) { try { await this.client.set(key, value, 'EX', Math.max(1, ttlSeconds)); } catch { /* database remains authoritative */ } }
  async del(key: string) { try { await this.client.del(key); } catch { /* cache entries expire */ } }
  async onModuleDestroy() { this.client.disconnect(); }
}
