import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController, ProfileController } from './auth.controller';
import { AuthService } from './auth.service';
import { CredentialHandler } from './credential.handler';
import { JwtAuthGuard } from './auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { AccessRegistryService } from './access-registry.service';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';

@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: process.env.JWT_EXPIRES_IN === undefined ? 7200 : parseDuration(process.env.JWT_EXPIRES_IN), algorithm: 'HS256' } })],
  controllers: [AuthController, ProfileController],
  providers: [AuthService, CredentialHandler, JwtAuthGuard, PermissionsGuard, AccessRegistryService, AuthRateLimitGuard],
  exports: [AuthService, JwtAuthGuard, PermissionsGuard],
})
export class AuthModule {}

function parseDuration(value: string): number {
  const match = /^(\d+)(s|m|h|d)?$/.exec(value);
  if (!match) throw new Error('JWT_EXPIRES_IN must be seconds or a duration such as 1h');
  const seconds = Number(match[1]) * ({ s: 1, m: 60, h: 3600, d: 86400 }[match[2] ?? 's'] ?? 1);
  if (seconds < 60 || seconds > 86400) throw new Error('JWT_EXPIRES_IN must be between 60 seconds and 1 day');
  return seconds;
}
