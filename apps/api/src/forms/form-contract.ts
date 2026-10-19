import { z } from 'zod';

export const questionInput = z.object({
  content: z.string().trim().min(1).max(2000),
  type_question: z.enum(['text', 'number', 'date', 'radio', 'checkbox', 'image_upload']),
  is_required: z.boolean().default(false),
  order: z.number().int().min(0).default(0),
  parent_question_id: z.string().uuid().nullable().optional(),
  show_if_answer: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).nullable().optional(),
  condition_rules: z.object({ operator: z.enum(['equals', 'contains', 'not_equals']), value: z.union([z.string(), z.number(), z.boolean()]) }).nullable().optional(),
  options: z.array(z.object({ label: z.string().trim().min(1), value: z.string().trim().min(1), order: z.number().int().min(0).default(0) })).max(100).default([]),
}).strict();

export function isValidScreeningQuestion(kind: string, type: string, parentId?: string | null): boolean {
  return kind !== 'classification' || type === 'radio' && !parentId;
}

export function hasParentCycle(questionId: string, parentId: string | null, parents: Map<string, string | null>): boolean {
  const visited = new Set<string>();
  let cursor = parentId;
  while (cursor) {
    if (cursor === questionId || visited.has(cursor)) return true;
    visited.add(cursor);
    cursor = parents.get(cursor) ?? null;
  }
  return false;
}
