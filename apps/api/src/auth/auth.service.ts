import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, compare } from 'bcryptjs';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { DomainException } from '../common/domain.exception';
import { Actor } from './current-user.decorator';
import { CredentialHandler } from './credential.handler';
import { createStaffSchema, profileSchema, signupSchema } from './auth.spec';
import { safeUser, safeUserSelect } from './safe-user';
import { validateAssignment } from './assignment';

export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(RedisService) private readonly redis: RedisService, @Inject(JwtService) private readonly jwt: JwtService, @Inject(CredentialHandler) private readonly credentials: CredentialHandler) {}
  async signup(input: z.infer<typeof signupSchema>) {
    if (await this.prisma.user.findFirst({ where: { OR: [{ phone: input.phone }, ...(input.email ? [{ email: input.email }] : [])] } })) throw new DomainException(3006, 'User phone or email already exists', 409);
    const { full_name, phone, email, password, confirm_password: _confirm, ...patient } = input;
    const user = await this.prisma.user.create({ data: { full_name, phone, email, password_hash: await hash(password, 12), patient: { create: patient }, notification_setting: { create: {} } }, select: safeUserSelect });
    return this.session(user.id);
  }
  async login(identifier: string, password: string) {
    const result = await this.credentials.execute(identifier, password);
    if (!result.success) throw new DomainException(result.error.code === 'UNAVAILABLE' ? 9001 : result.error.code === 'ACCOUNT_DISABLED' ? 3010 : 3008, result.error.message, result.error.code === 'UNAVAILABLE' ? 503 : 401);
    return this.session(result.data.id);
  }
  private async session(id: string) {
    const [user, privateUser] = await Promise.all([this.prisma.user.findUnique({ where: { id }, select: safeUserSelect }), this.prisma.user.findUnique({ where: { id }, select: { token_version: true } })]);
    if (!user || !privateUser) throw new DomainException(3007, 'User not found', 404);
    const token = await this.jwt.signAsync({ sub: id, jti: randomUUID(), version: privateUser.token_version });
    return { token, access_token: token, token_type: 'Bearer', user: safeUser(user) };
  }
  async profile(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: safeUserSelect });
    if (!user) throw new DomainException(3007, 'User not found', 404);
    return safeUser(user);
  }
  async updateProfile(id: string, input: z.infer<typeof profileSchema>) {
    const { full_name, email, ...patient } = input;
    const user = await this.prisma.user.findUnique({ where: { id }, select: { patient: { select: { user_id: true } } } });
    if (!user) throw new DomainException(3007, 'User not found', 404);
    if (!user.patient && Object.keys(patient).length > 0) throw new DomainException(2003, 'Clinical demographics require a patient profile');
    return safeUser(await this.prisma.user.update({ where: { id }, data: { full_name, email, ...(user.patient ? { patient: { update: patient } } : {}) }, select: safeUserSelect }));
  }
  async logout(actor: Actor, bearer: string, deviceId?: string) {
    const expires = actor.expires_at ?? Math.floor(Date.now() / 1000) + 7200;
    const digest = tokenHash(bearer);
    await this.prisma.$transaction([
      this.prisma.tokenBlacklist.upsert({ where: { token_hash: digest }, create: { token_hash: digest, user_id: actor.id, expires_at: new Date(expires * 1000) }, update: {} }),
      this.prisma.userFcmToken.deleteMany({ where: { user_id: actor.id, ...(deviceId ? { device_id: deviceId } : {}) } }),
    ]);
    await this.redis.set(`blacklist:${digest}`, '1', expires - Math.floor(Date.now() / 1000));
    return { logged_out: true };
  }
  async changePassword(actor: Actor, oldPassword: string, newPassword: string, bearer?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: actor.id } });
    if (!user || !(await compare(oldPassword, user.password_hash))) throw new DomainException(3009, 'Old password incorrect');
    const updates = [this.prisma.user.update({ where: { id: actor.id }, data: { password_hash: await hash(newPassword, 12), token_version: { increment: 1 }, reset_token: null, reset_expires_at: null } })];
    if (bearer) {
      const digest = tokenHash(bearer);
      const expires = actor.expires_at ?? Math.floor(Date.now() / 1000) + 7200;
      await this.prisma.$transaction([updates[0], this.prisma.tokenBlacklist.upsert({ where: { token_hash: digest }, create: { token_hash: digest, user_id: actor.id, expires_at: new Date(expires * 1000) }, update: {} })]);
      await this.redis.set(`blacklist:${digest}`, '1', expires - Math.floor(Date.now() / 1000));
    } else await updates[0];
    return { changed: true, reauthenticate: true };
  }
  async forgotPassword(phone: string) {
    const deliveryUrl = process.env.OTP_DELIVERY_URL;
    if (!deliveryUrl) throw new DomainException(9002, 'Password recovery delivery provider is not configured', 503);
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) return { message: 'If the account exists, a recovery code will be delivered' };
    const code = String(randomInt(100000, 1000000));
    const response = await fetch(deliveryUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.OTP_DELIVERY_TOKEN ? { Authorization: `Bearer ${process.env.OTP_DELIVERY_TOKEN}` } : {}) }, body: JSON.stringify({ phone, code, expires_in: 600 }), signal: AbortSignal.timeout(5000) }).catch(() => null);
    if (!response?.ok) throw new DomainException(9002, 'Recovery delivery unavailable', 503);
    await this.prisma.user.update({ where: { id: user.id }, data: { reset_token: tokenHash(`${user.id}:${code}`), reset_expires_at: new Date(Date.now() + 600000) } });
    return { message: 'If the account exists, a recovery code will be delivered' };
  }
  async resetPassword(phone: string, code: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user || !user.reset_expires_at || user.reset_expires_at.getTime() < Date.now() || user.reset_token !== tokenHash(`${user.id}:${code}`)) throw new DomainException(3011, 'Recovery code invalid or expired');
    const changed = await this.prisma.user.updateMany({ where: { id: user.id, reset_token: user.reset_token, reset_expires_at: { gt: new Date() } }, data: { password_hash: await hash(newPassword, 12), reset_token: null, reset_expires_at: null, token_version: { increment: 1 } } });
    if (changed.count !== 1) throw new DomainException(3011, 'Recovery code has already been used');
    return { changed: true };
  }
  async createStaff(input: z.infer<typeof createStaffSchema>) {
    await validateAssignment(this.prisma, input);
    const role = await this.prisma.role.findUnique({ where: { id: input.role_id } });
    if (!role || role.code === 'patient') throw new DomainException(2003, 'Invalid staff role');
    if (await this.prisma.user.findFirst({ where: { OR: [{ phone: input.phone }, ...(input.email ? [{ email: input.email }] : [])] } })) throw new DomainException(3006, 'User phone or email already exists', 409);
    const { full_name, phone, password, email, ...staff } = input;
    const user = await this.prisma.user.create({ data: { full_name, phone, email, password_hash: await hash(password, 12), staff: { create: staff }, notification_setting: { create: {} } }, select: safeUserSelect });
    return safeUser(user);
  }
}
