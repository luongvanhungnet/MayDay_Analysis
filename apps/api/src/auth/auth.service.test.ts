import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { JwtService } from '@nestjs/jwt';
import { CredentialHandler } from './credential.handler';

vi.mock('bcryptjs', () => ({ compare: vi.fn(async () => true), hash: vi.fn(async () => 'new-hash') }));

describe('password changes', () => {
  it('writes the current access token to both persistent blacklist and Redis', async () => {
    const prisma = { user: { findUnique: vi.fn(async () => ({ id: 'user', password_hash: 'old-hash' })), update: vi.fn(async () => ({})) }, tokenBlacklist: { upsert: vi.fn(async () => ({})) }, $transaction: vi.fn(async (requests) => Promise.all(requests)) };
    const redis = { set: vi.fn(async () => undefined) };
    const service = new AuthService(prisma as unknown as PrismaService, redis as unknown as RedisService, {} as JwtService, {} as CredentialHandler);
    await (service.changePassword as (...args: unknown[]) => Promise<unknown>)({ id: 'user', role: 'patient', expires_at: Math.floor(Date.now() / 1000) + 60 }, 'old-password', 'new-password', 'access-token');
    expect(prisma.tokenBlacklist.upsert).toHaveBeenCalledOnce();
    expect(redis.set).toHaveBeenCalledOnce();
  });
});
