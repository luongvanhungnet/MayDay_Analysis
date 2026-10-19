import { expect, it } from 'vitest';
import { profileSchema } from './auth.spec';

it('rejects attempts to escalate role through own profile', () => {
  expect(profileSchema.safeParse({ full_name: 'Nguyen A', role_id: '00000000-0000-4000-8000-000000000001', is_active: true }).success).toBe(false);
});
