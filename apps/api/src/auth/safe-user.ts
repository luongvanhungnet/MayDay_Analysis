import { Prisma } from '@prisma/client';

export const safeUserSelect = {
  id: true, full_name: true, phone: true, email: true, is_active: true, created_at: true,
  patient: true,
  staff: { include: { role: true, branch: true, department: true, room: true } },
} satisfies Prisma.UserSelect;
export type SafeUser = Prisma.UserGetPayload<{ select: typeof safeUserSelect }>;
export function safeUser(user: SafeUser) {
  return { ...user, patient: user.patient ? { ...user.patient, id: user.patient.user_id } : null, role: user.staff?.role.code ?? 'patient' };
}
