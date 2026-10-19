import { z } from 'zod';
import { uuid } from '../common/validation';

export const phone = z.string().trim().regex(/^(?:\+84|0)[0-9]{9,10}$/, 'Invalid phone number format');
const password = z.string().min(8, 'Password must contain at least 8 characters').max(72);
export const loginSchema = z.object({ phone: phone.optional(), email: z.string().email().optional(), password: z.string().min(1).max(72) }).strict().refine((v) => !!v.phone || !!v.email, 'Phone or email required');
export const profileSchema = z.object({
  full_name: z.string().trim().min(2).max(150).optional(),
  email: z.string().email().nullable().optional(),
  year_of_birth: z.number().int().min(1900).max(new Date().getUTCFullYear()).nullable().optional(),
  gender: z.enum(['male', 'female', 'other']).nullable().optional(),
  occupation: z.string().max(200).nullable().optional(), ethnicity: z.string().max(100).nullable().optional(),
  address: z.string().max(500).nullable().optional(), province: z.string().max(150).nullable().optional(), district: z.string().max(150).nullable().optional(), ward: z.string().max(150).nullable().optional(),
  insurance_number: z.string().max(50).nullable().optional(), emergency_contact: z.string().max(150).nullable().optional(), emergency_phone: phone.nullable().optional(),
}).strict();
export const signupSchema = z.object({ ...profileSchema.shape, full_name: z.string().trim().min(2).max(150), phone, email: z.string().email().optional(), password, confirm_password: z.string().optional() }).strict().refine((v) => !v.confirm_password || v.password === v.confirm_password, 'Passwords do not match');
export const assignmentSchema = z.object({ branch_id: uuid.nullable().optional(), department_id: uuid.nullable().optional(), room_id: uuid.nullable().optional() }).strict();
export const createStaffSchema = z.object({ full_name: z.string().trim().min(2).max(150), phone, email: z.string().email().optional(), password, role_id: uuid, branch_id: uuid.nullable().optional(), department_id: uuid.nullable().optional(), room_id: uuid.nullable().optional(), specialty: z.string().max(200).optional() }).strict();
export const changePasswordSchema = z.object({ oldPassword: z.string().min(1), newPassword: password, confirm_password: z.string() }).strict().refine((v) => v.newPassword === v.confirm_password, 'Passwords do not match');
export const forgotSchema = z.object({ phone }).strict();
export const resetSchema = z.object({ phone, token: z.string().regex(/^\d{6}$/), newPassword: password, confirm_password: z.string() }).strict().refine((v) => v.newPassword === v.confirm_password, 'Passwords do not match');

export type CredentialResult = { success: true; data: { id: string } } | { success: false; error: { code: 'INVALID_CREDENTIALS' | 'ACCOUNT_DISABLED' | 'UNAVAILABLE'; message: string } };
export interface CredentialSpec { execute(phoneOrEmail: string, password: string): Promise<CredentialResult> }
