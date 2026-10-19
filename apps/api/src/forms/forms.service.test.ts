import { expect, test, vi } from 'vitest';
import { FormsService } from './forms.service';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

test('administrators can save classification rules using configured screening options', async () => {
  const question_id = '30000000-0000-4000-8000-000000000022';
  const classification_rules = { priority: 20, conditions: [{ question_id, value: 'yes' }] };
  const create = vi.fn().mockResolvedValue({ id: 'new', classification_rules });
  const db = { question: { findMany: vi.fn().mockResolvedValue([{ id: question_id, options: [{ value: 'yes' }, { value: 'no' }] }]) }, template: { create } } as unknown as PrismaService;
  const service = new FormsService(db, {} as RedisService);
  await expect(service.create({ name: 'Followup', kind: 'clinical', classification_rules })).resolves.toMatchObject({ classification_rules });
  expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ kind: 'clinical', classification_rules }) });
});
