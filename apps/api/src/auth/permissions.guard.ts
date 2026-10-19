import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../common/prisma.service';
import { DomainException } from '../common/domain.exception';
import { PERMISSION_KEY, PUBLIC_KEY } from './access.decorator';
import { Actor } from './current-user.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector, @Inject(PrismaService) private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const permission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    if (!permission) return true;
    const request = context.switchToHttp().getRequest();
    const actor: Actor = request.user;
    if (!actor?.role_id) throw new DomainException(3101, 'Permission denied', 403);
    const path = String(request.route?.path ?? '').replace(/^\/api\/v1/, '') || '/';
    const endpoint = await this.prisma.apiEndpoint.findUnique({ where: { method_path: { method: request.method, path } }, include: { permissions: { include: { permission: { include: { roles: true } } } } } });
    const allowed = endpoint?.permissions.some((mapping) => mapping.permission.roles.some((grant) => grant.role_id === actor.role_id));
    if (!allowed) throw new DomainException(permission === 'admin.manage' ? 3102 : 3101, 'Permission denied', 403);
    return true;
  }
}
