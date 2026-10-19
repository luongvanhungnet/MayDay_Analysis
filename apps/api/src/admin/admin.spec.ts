import { z } from 'zod';
import { uuid } from '../common/validation';
import { phone } from '../auth/auth.spec';

export const adminCreateUserSchema = z.object({ full_name: z.string().trim().min(2).max(150), phone, email: z.string().email().optional(), password: z.string().min(8).max(72), role_id: uuid.optional(), branch_id: uuid.nullable().optional(), department_id: uuid.nullable().optional(), room_id: uuid.nullable().optional() }).strict();
export const adminUpdateSchema = z.object({ full_name: z.string().trim().min(2).max(150).optional(), phone: phone.optional(), email: z.string().email().nullable().optional(), is_active: z.boolean().optional(), role_id: uuid.optional(), specialty: z.string().max(200).optional() }).strict();
export const roleSchema = z.object({ name: z.string().trim().min(1).max(100), code: z.string().regex(/^[a-z][a-z0-9_.-]{1,99}$/), description: z.string().max(500).nullable().optional(), parent_role_id: uuid.nullable().optional() }).strict();
export const permissionSchema = z.object({ name: z.string().trim().min(1).max(100), code: z.string().regex(/^[a-z][a-z0-9_.-]{1,99}$/), description: z.string().max(500).nullable().optional() }).strict();
export const rolePermissionsSchema = z.object({ role_id: uuid, permission_ids: z.array(uuid).min(1).max(100) }).strict();
export const endpointSchema = z.object({ method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']), path: z.string().min(1).max(300).refine((p) => p.startsWith('/') && !p.startsWith('/api/v1'), 'Use route path without /api/v1 prefix'), description: z.string().max(500).optional(), permission_ids: z.array(uuid).max(100).default([]) }).strict();
