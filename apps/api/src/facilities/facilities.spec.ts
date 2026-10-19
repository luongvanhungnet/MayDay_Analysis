import { z } from 'zod';
import { uuid } from '../common/validation';
export const branchSchema = z.object({ name: z.string().trim().min(1).max(150), address: z.string().max(500).nullable().optional(), phone: z.string().max(30).nullable().optional(), is_active: z.boolean().optional() }).strict();
export const departmentSchema = z.object({ name: z.string().trim().min(1).max(150), branch_id: uuid, description: z.string().max(500).nullable().optional() }).strict();
export const roomSchema = z.object({ name: z.string().trim().min(1).max(150), department_id: uuid.nullable(), description: z.string().max(500).nullable().optional() }).strict();
