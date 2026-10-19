import { PrismaService } from '../common/prisma.service';
import { DomainException } from '../common/domain.exception';

export interface Assignment { branch_id?: string | null; department_id?: string | null; room_id?: string | null }
export async function validateAssignment(prisma: PrismaService, value: Assignment): Promise<void> {
  if (value.branch_id && !(await prisma.branch.findUnique({ where: { id: value.branch_id } }))) throw new DomainException(2003, 'Branch not found');
  if (value.department_id) {
    const department = await prisma.department.findUnique({ where: { id: value.department_id } });
    if (!department || !value.branch_id || department.branch_id !== value.branch_id) throw new DomainException(2003, 'Department must belong to selected branch');
  }
  if (value.room_id) {
    const room = await prisma.room.findUnique({ where: { id: value.room_id } });
    if (!room || !value.department_id || room.department_id !== value.department_id) throw new DomainException(2003, 'Room must belong to selected department');
  }
}
