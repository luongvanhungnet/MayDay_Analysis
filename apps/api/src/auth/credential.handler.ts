import { Injectable, Inject } from '@nestjs/common';
import { compare } from 'bcryptjs';
import { PrismaService } from '../common/prisma.service';
import { CredentialResult, CredentialSpec } from './auth.spec';

@Injectable()
export class CredentialHandler implements CredentialSpec {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async execute(identifier: string, password: string): Promise<CredentialResult> {
    try {
      const user = await this.prisma.user.findFirst({ where: { OR: [{ phone: identifier }, { email: identifier }] } });
      if (!user || !(await compare(password, user.password_hash))) return { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Phone/email or password incorrect' } };
      if (!user.is_active) return { success: false, error: { code: 'ACCOUNT_DISABLED', message: 'Account is disabled' } };
      return { success: true, data: { id: user.id } };
    } catch { return { success: false, error: { code: 'UNAVAILABLE', message: 'Authentication temporarily unavailable' } }; }
  }
}
