import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../common/prisma.service';
import { DomainException } from '../common/domain.exception';
import { pageMeta } from '../common/validation';
import { branchSchema, departmentSchema, roomSchema } from './facilities.spec';

@Injectable()
export class FacilitiesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async branches(page: number, limit: number, search?: string) {
    const where = search ? { name: { contains: search, mode: 'insensitive' as const } } : {};
    const [data, total] = await this.prisma.$transaction([this.prisma.branch.findMany({ where, include: { _count: { select: { departments: true, staffs: true } } }, orderBy: { name: 'asc' }, skip: (page - 1) * limit, take: limit }), this.prisma.branch.count({ where })]);
    return { data, meta: pageMeta(page, limit, total) };
  }
  async branch(id: string) {
    const data = await this.prisma.branch.findUnique({ where: { id }, include: { departments: { include: { rooms: true } }, _count: { select: { staffs: true } } } });
    if (!data) throw new DomainException(2003, 'Branch not found', 404);
    return data;
  }
  createBranch(input: z.infer<typeof branchSchema>) { return this.prisma.branch.create({ data: input }); }
  async updateBranch(id: string, input: Partial<z.infer<typeof branchSchema>>) { await this.branch(id); return this.prisma.branch.update({ where: { id }, data: input }); }
  async deleteBranch(id: string) {
    await this.branch(id);
    if (await this.prisma.department.count({ where: { branch_id: id } }) || await this.prisma.staff.count({ where: { branch_id: id } })) throw new DomainException(2003, 'Branch contains departments or staff', 409);
    await this.prisma.branch.delete({ where: { id } }); return { deleted: true };
  }
  async departments(page: number, limit: number, branch_id?: string) {
    const where = branch_id ? { branch_id } : {};
    const [data, total] = await this.prisma.$transaction([this.prisma.department.findMany({ where, include: { branch: true, _count: { select: { rooms: true, staffs: true } } }, orderBy: { name: 'asc' }, skip: (page - 1) * limit, take: limit }), this.prisma.department.count({ where })]);
    return { data, meta: pageMeta(page, limit, total) };
  }
  async department(id: string) {
    const data = await this.prisma.department.findUnique({ where: { id }, include: { branch: true, rooms: true } });
    if (!data) throw new DomainException(2003, 'Department not found', 404);
    return data;
  }
  async createDepartment(input: z.infer<typeof departmentSchema>) { await this.branch(input.branch_id); return this.prisma.department.create({ data: input }); }
  async updateDepartment(id: string, input: Partial<z.infer<typeof departmentSchema>>) {
    const existing = await this.department(id);
    if (input.branch_id && input.branch_id !== existing.branch_id) {
      await this.branch(input.branch_id);
      if (await this.prisma.staff.count({ where: { OR: [{ department_id: id }, { room: { department_id: id } }] } })) throw new DomainException(2003, 'Reassign staff before moving this department to another branch', 409);
    }
    return this.prisma.department.update({ where: { id }, data: input });
  }
  async deleteDepartment(id: string) { await this.department(id); await this.prisma.department.delete({ where: { id } }); return { deleted: true }; }
  async rooms(page: number, limit: number, department_id?: string) {
    const where = department_id ? { department_id } : {};
    const [data, total] = await this.prisma.$transaction([this.prisma.room.findMany({ where, include: { department: { include: { branch: true } }, _count: { select: { staffs: true } } }, orderBy: { name: 'asc' }, skip: (page - 1) * limit, take: limit }), this.prisma.room.count({ where })]);
    return { data, meta: pageMeta(page, limit, total) };
  }
  async room(id: string) {
    const data = await this.prisma.room.findUnique({ where: { id }, include: { department: true, _count: { select: { staffs: true } } } });
    if (!data) throw new DomainException(2003, 'Room not found', 404);
    return data;
  }
  async createRoom(input: z.infer<typeof roomSchema>) { if (input.department_id) await this.department(input.department_id); return this.prisma.room.create({ data: input }); }
  async updateRoom(id: string, input: Partial<z.infer<typeof roomSchema>>) {
    const existing = await this.room(id);
    if (input.department_id !== undefined && input.department_id !== existing.department_id) {
      if (existing._count.staffs) throw new DomainException(2003, 'Reassign staff before moving this room', 409);
      if (input.department_id) await this.department(input.department_id);
    }
    return this.prisma.room.update({ where: { id }, data: input });
  }
  async deleteRoom(id: string) {
    const existing = await this.room(id);
    if (existing._count.staffs) throw new DomainException(2003, 'Room has assigned staff', 409);
    await this.prisma.room.delete({ where: { id } }); return { deleted: true };
  }
}
