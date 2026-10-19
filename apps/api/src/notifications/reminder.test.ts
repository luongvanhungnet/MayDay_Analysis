import { expect, test } from 'vitest';
import { reminderId } from './reminder';
test('daily reminder deduplication keys are stable PostgreSQL UUIDs across restarts', () => {
  const id = reminderId('patient', '2026-10-08', 'uas7');
  expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  expect(reminderId('patient', '2026-10-08', 'uas7')).toBe(id);
  expect(reminderId('patient', '2026-10-09', 'uas7')).not.toBe(id);
});
