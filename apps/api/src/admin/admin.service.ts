import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../common/prisma.service';
import { DomainException } from '../common/domain.exception';
import { pageMeta } from '../common/validation';
import { AuthService } from '../auth/auth.service';
import { Actor } from '../auth/current-user.decorator';
import { safeUser, safeUserSelect } from '../auth/safe-user';
import { Assignment, validateAssignment } from '../auth/assignment';
import { adminCreateUserSchema, adminUpdateSchema, endpointSchema, permissionSchema, roleSchema } from './admin.spec';

@Injectable()
export class AdminService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AuthService) private readonly auth: AuthService) {}
  async users(page: number, limit: number, search?: string, role?: string) {
    const where: Prisma.UserWhereInput = { ...(search ? { OR: [{ full_name: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] } : {}), ...(role === 'patient' ? { patient: { isNot: null } } : role ? { staff: { is: { role: { code: role } } } } : {}) };
    const [users, total] = await this.prisma.$transaction([this.prisma.user.findMany({ where, select: safeUserSelect, orderBy: { created_at: 'desc' }, skip: (page - 1) * limit, take: limit }), this.prisma.user.count({ where })]);
    return { data: users.map(safeUser), meta: pageMeta(page, limit, total) };
  }
  user(id: string) { return this.auth.profile(id); }
  async createUser(input: z.infer<typeof adminCreateUserSchema>) {
    if (input.role_id) return this.auth.createStaff({ ...input, role_id: input.role_id });
    if (input.branch_id || input.department_id || input.room_id) throw new DomainException(2003, 'Patient accounts cannot receive staff assignments');
    const session = await this.auth.signup({ full_name: input.full_name, phone: input.phone, email: input.email, password: input.password });
    return session.user;
  }
  async updateUser(id: string, input: z.infer<typeof adminUpdateSchema>, actor: Actor) {
    const existing = await this.prisma.user.findUnique({ where: { id }, include: { staff: true } });
    if (!existing) throw new DomainException(3007, 'User not found', 404);
    if (id === actor.id && (input.is_active === false || (input.role_id && input.role_id !== actor.role_id))) throw new DomainException(2003, 'Cannot disable your account or remove your own administrator role');
    const { role_id, specialty, ...user } = input;
    if ((role_id || specialty !== undefined) && !existing.staff) throw new DomainException(2003, 'Staff fields require a staff account');
    if (role_id) {
      const role = await this.prisma.role.findUnique({ where: { id: role_id } });
      if (!role || role.code === 'patient') throw new DomainException(2003, 'Invalid staff role');
    }
    return safeUser(await this.prisma.user.update({ where: { id }, data: { ...user, ...(user.is_active === false ? { token_version: { increment: 1 } } : {}), ...(existing.staff ? { staff: { update: { role_id, specialty } } } : {}) }, select: safeUserSelect }));
  }
  async deleteUser(id: string, actor: Actor) {
    if (id === actor.id) throw new DomainException(2003, 'Cannot delete your own account');
    const user = await this.prisma.user.findUnique({ where: { id }, include: { patient: { include: { _count: { select: { medical_records: true, lesion_episodes: true, uas7_scores: true } } } } } });
    if (!user) throw new DomainException(3007, 'User not found', 404);
    if (user.patient && Object.values(user.patient._count).some((count) => count > 0)) throw new DomainException(2003, 'Patient has clinical history; deactivate the account to preserve records', 409);
    if (await this.prisma.mediaAttachment.count({ where: { uploaded_by: id } })) throw new DomainException(2003, 'User owns medical attachments; deactivate the account to preserve them', 409);
    await this.prisma.$transaction(async (tx) => {
      if (user.patient) await tx.patient.delete({ where: { user_id: id } });
      await tx.user.delete({ where: { id } });
    });
    return { deleted: true };
  }
  async assign(id: string, input: Assignment) {
    const staff = await this.prisma.staff.findUnique({ where: { user_id: id } });
    if (!staff) throw new DomainException(3007, 'Staff not found', 404);
    const assignment = { branch_id: input.branch_id === undefined ? staff.branch_id : input.branch_id, department_id: input.department_id === undefined ? staff.department_id : input.department_id, room_id: input.room_id === undefined ? staff.room_id : input.room_id };
    await validateAssignment(this.prisma, assignment);
    await this.prisma.staff.update({ where: { user_id: id }, data: assignment });
    return this.auth.profile(id);
  }
  roles() { return this.prisma.role.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { staffs: true, permissions: true } } } }); }
  async createRole(input: z.infer<typeof roleSchema>) {
    if (input.parent_role_id && !(await this.prisma.role.findUnique({ where: { id: input.parent_role_id } }))) throw new DomainException(2003, 'Parent role not found');
    return this.prisma.role.create({ data: input });
  }
  async updateRole(id: string, input: Partial<z.infer<typeof roleSchema>>) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new DomainException(2003, 'Role not found', 404);
    if (input.code && input.code !== role.code && ['admin', 'doctor', 'patient'].includes(role.code)) throw new DomainException(2003, 'Built-in role codes cannot be renamed');
    let ancestor = input.parent_role_id;
    const visited = new Set([id]);
    while (ancestor) {
      if (visited.has(ancestor)) throw new DomainException(2003, 'Role hierarchy cannot contain cycles');
      visited.add(ancestor);
      const parent = await this.prisma.role.findUnique({ where: { id: ancestor } });
      if (!parent) throw new DomainException(2003, 'Parent role not found');
      ancestor = parent.parent_role_id;
    }
    return this.prisma.role.update({ where: { id }, data: input });
  }
  async deleteRole(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new DomainException(2003, 'Role not found', 404);
    if (['admin', 'doctor', 'patient'].includes(role.code)) throw new DomainException(2003, 'Built-in roles cannot be deleted');
    await this.prisma.role.delete({ where: { id } });
    return { deleted: true };
  }
  permissions() { return this.prisma.permission.findMany({ orderBy: { code: 'asc' } }); }
  createPermission(input: z.infer<typeof permissionSchema>) { return this.prisma.permission.create({ data: input }); }
  updatePermission(id: string, input: Partial<z.infer<typeof permissionSchema>>) { return this.prisma.permission.update({ where: { id }, data: input }); }
  async deletePermission(id: string) { await this.prisma.permission.delete({ where: { id } }); return { deleted: true }; }
  rolePermissions(role_id: string) { return this.prisma.rolePermission.findMany({ where: { role_id }, include: { permission: true } }); }
  async grantPermissions(role_id: string, ids: string[]) {
    if (!(await this.prisma.role.findUnique({ where: { id: role_id } }))) throw new DomainException(2003, 'Role not found');
    const permissionIds = [...new Set(ids)];
    if (await this.prisma.permission.count({ where: { id: { in: permissionIds } } }) !== permissionIds.length) throw new DomainException(2003, 'One or more permissions not found');
    await this.prisma.rolePermission.createMany({ data: permissionIds.map((permission_id) => ({ role_id, permission_id })), skipDuplicates: true });
    return this.rolePermissions(role_id);
  }
  async revokePermission(role_id: string, permission_id: string) {
    await this.prisma.rolePermission.deleteMany({ where: { role_id, permission_id } });
    return { revoked: true };
  }
  endpoints() { return this.prisma.apiEndpoint.findMany({ orderBy: [{ path: 'asc' }, { method: 'asc' }], include: { permissions: { include: { permission: true } } } }); }
  async createEndpoint(input: z.infer<typeof endpointSchema>) {
    const { permission_ids, ...endpoint } = input;
    const ids = [...new Set(permission_ids)];
    if (await this.prisma.permission.count({ where: { id: { in: ids } } }) !== ids.length) throw new DomainException(2003, 'Permission not found');
    return this.prisma.apiEndpoint.create({ data: { ...endpoint, permissions: { create: ids.map((permission_id) => ({ permission_id })) } }, include: { permissions: true } });
  }
  async endpointPermissions(endpoint_id: string, permission_ids: string[]) {
    const ids = [...new Set(permission_ids)];
    if (!(await this.prisma.apiEndpoint.findUnique({ where: { id: endpoint_id } }))) throw new DomainException(2003, 'Endpoint not found');
    if (await this.prisma.permission.count({ where: { id: { in: ids } } }) !== ids.length) throw new DomainException(2003, 'Permission not found');
    await this.prisma.$transaction([this.prisma.permissionEndpoint.deleteMany({ where: { endpoint_id } }), this.prisma.permissionEndpoint.createMany({ data: ids.map((permission_id) => ({ endpoint_id, permission_id })), skipDuplicates: true })]);
    return this.prisma.apiEndpoint.findUnique({ where: { id: endpoint_id }, include: { permissions: true } });
  }
}
