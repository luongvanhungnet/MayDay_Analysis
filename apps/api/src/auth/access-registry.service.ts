import { Inject, Injectable, OnApplicationBootstrap, RequestMethod } from '@nestjs/common';
import { ModulesContainer, Reflector } from '@nestjs/core';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PrismaService } from '../common/prisma.service';
import { PERMISSION_KEY } from './access.decorator';

@Injectable()
export class AccessRegistryService implements OnApplicationBootstrap {
  constructor(@Inject(ModulesContainer) private readonly modules: ModulesContainer, @Inject(Reflector) private readonly reflector: Reflector, @Inject(PrismaService) private readonly prisma: PrismaService) {}
  async onApplicationBootstrap() {
    for (const module of this.modules.values()) for (const controller of module.controllers.values()) {
      if (!controller.metatype) continue;
      const type = controller.metatype;
      const base = Reflect.getMetadata(PATH_METADATA, type) ?? '';
      for (const name of Object.getOwnPropertyNames(type.prototype)) {
        const handler = type.prototype[name];
        if (typeof handler !== 'function') continue;
        const methodIndex = Reflect.getMetadata(METHOD_METADATA, handler);
        const permissionCode = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [handler, type]);
        if (methodIndex === undefined || !permissionCode) continue;
        const permission = await this.prisma.permission.findUnique({ where: { code: permissionCode } });
        if (!permission) continue;
        const child = Reflect.getMetadata(PATH_METADATA, handler) ?? '';
        for (const parentPath of Array.isArray(base) ? base : [base]) for (const childPath of Array.isArray(child) ? child : [child]) {
          const path = `/${[parentPath, childPath].filter(Boolean).join('/')}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
          const method = RequestMethod[methodIndex];
          const existing = await this.prisma.apiEndpoint.findUnique({ where: { method_path: { method, path } } });
          if (!existing) await this.prisma.apiEndpoint.create({ data: { method, path, description: permissionCode, permissions: { create: { permission_id: permission.id } } } });
        }
      }
    }
  }
}
