import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { DomainException } from '../common/domain.exception';
import { PUBLIC_KEY } from './access.decorator';
import { tokenHash } from './auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector, @Inject(JwtService) private readonly jwt: JwtService, @Inject(PrismaService) private readonly prisma: PrismaService, @Inject(RedisService) private readonly redis: RedisService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const req = context.switchToHttp().getRequest();
    const header = req.headers.authorization;
    if (typeof header !== 'string' || !/^Bearer\s+\S+$/i.test(header)) throw new DomainException(3003, 'User not authenticated', 401);
    const token = header.slice(7);
    let payload: { sub: string; jti: string; version: number; exp: number };
    try { payload = await this.jwt.verifyAsync(token, { algorithms: ['HS256'] }); } catch { throw new DomainException(3002, 'Token invalid or expired', 401); }
    if (!payload.sub || !payload.jti || !Number.isInteger(payload.version) || !payload.exp) throw new DomainException(3001, 'Invalid session token', 401);
    const digest = tokenHash(token);
    if (await this.redis.get(`blacklist:${digest}`)) throw new DomainException(3001, 'Token revoked', 401);
    const [user, revoked] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: payload.sub }, include: { staff: { include: { role: true } }, patient: true } }),
      this.prisma.tokenBlacklist.findUnique({ where: { token_hash: digest } }),
    ]);
    if (revoked || !user?.is_active || user.token_version !== payload.version) throw new DomainException(3001, 'Session has been revoked', 401);
    const role = user.staff?.role ?? await this.prisma.role.findUnique({ where: { code: 'patient' } });
    if (!role) throw new DomainException(3101, 'Account role is not configured', 403);
    req.user = { id: user.id, role: role.code, role_id: role.id, token_id: payload.jti, token_version: payload.version, expires_at: payload.exp };
    return true;
  }
}
