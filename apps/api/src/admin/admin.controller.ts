import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { parse, paginationSchema, uuid } from '../common/validation';
import { RequirePermission } from '../auth/access.decorator';
import { Actor, CurrentUser } from '../auth/current-user.decorator';
import { assignmentSchema } from '../auth/auth.spec';
import { AdminService } from './admin.service';
import { adminCreateUserSchema, adminUpdateSchema, endpointSchema, permissionSchema, rolePermissionsSchema, roleSchema } from './admin.spec';

@RequirePermission('admin.manage')
@Controller('admin/users')
export class AdminUsersController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}
  @Get() list(@Query() raw: unknown) { const input = parse(paginationSchema.extend({ role: z.string().max(100).optional() }), raw); return this.admin.users(input.page, input.limit, input.search, input.role); }
  @Get(':id') user(@Param('id') id: string) { return this.admin.user(parse(uuid, id)); }
  @Post() create(@Body() raw: unknown) { return this.admin.createUser(parse(adminCreateUserSchema, raw)); }
  @Put(':id') update(@Param('id') id: string, @Body() raw: unknown, @CurrentUser() actor: Actor) { return this.admin.updateUser(parse(uuid, id), parse(adminUpdateSchema, raw), actor); }
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() actor: Actor) { return this.admin.deleteUser(parse(uuid, id), actor); }
  @Put(':id/assign') assign(@Param('id') id: string, @Body() raw: unknown) { return this.admin.assign(parse(uuid, id), parse(assignmentSchema, raw)); }
}

@RequirePermission('admin.manage') @Controller('roles')
export class RolesController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}
  @Get() list() { return this.admin.roles(); }
  @Post() create(@Body() raw: unknown) { return this.admin.createRole(parse(roleSchema, raw)); }
  @Put(':id') update(@Param('id') id: string, @Body() raw: unknown) { return this.admin.updateRole(parse(uuid, id), parse(roleSchema.partial(), raw)); }
  @Delete(':id') remove(@Param('id') id: string) { return this.admin.deleteRole(parse(uuid, id)); }
}

@RequirePermission('admin.manage') @Controller('permissions')
export class PermissionsController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}
  @Get() list() { return this.admin.permissions(); }
  @Post() create(@Body() raw: unknown) { return this.admin.createPermission(parse(permissionSchema, raw)); }
  @Put(':id') update(@Param('id') id: string, @Body() raw: unknown) { return this.admin.updatePermission(parse(uuid, id), parse(permissionSchema.partial(), raw)); }
  @Delete(':id') remove(@Param('id') id: string) { return this.admin.deletePermission(parse(uuid, id)); }
}

@RequirePermission('admin.manage') @Controller('role_permissions')
export class RolePermissionsController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}
  @Get() list(@Query('role_id') role_id: string) { return this.admin.rolePermissions(parse(uuid, role_id)); }
  @Get(':role_id') role(@Param('role_id') role_id: string) { return this.admin.rolePermissions(parse(uuid, role_id)); }
  @Post() grant(@Body() raw: unknown) { const input = parse(rolePermissionsSchema, raw); return this.admin.grantPermissions(input.role_id, input.permission_ids); }
  @Delete(':role_id/:permission_id') revoke(@Param('role_id') role_id: string, @Param('permission_id') permission_id: string) { return this.admin.revokePermission(parse(uuid, role_id), parse(uuid, permission_id)); }
  @Delete() revokeBody(@Body() raw: unknown) { const input = parse(z.object({ role_id: uuid, permission_id: uuid }).strict(), raw); return this.admin.revokePermission(input.role_id, input.permission_id); }
}

@RequirePermission('admin.manage') @Controller('api-endpoints')
export class ApiEndpointsController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}
  @Get() list() { return this.admin.endpoints(); }
  @Post() create(@Body() raw: unknown) { return this.admin.createEndpoint(parse(endpointSchema, raw)); }
  @Put(':id/permissions') mapping(@Param('id') id: string, @Body() raw: unknown) { const input = parse(z.object({ permission_ids: z.array(uuid).max(100) }).strict(), raw); return this.admin.endpointPermissions(parse(uuid, id), input.permission_ids); }
}
