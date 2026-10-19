import { z } from 'zod';
import { DomainException } from './domain.exception';

export function parse<S extends z.ZodTypeAny>(schema: S, raw: unknown): z.output<S> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const code = issue.code === 'invalid_type' ? (issue.received === 'undefined' ? 2001 : 2002) : issue.path[0] === 'phone' ? 2004 : 2003;
    throw new DomainException(code, `${issue.path.join('.') || 'request'}: ${issue.message}`, 400);
  }
  return result.data;
}

export const uuid = z.string().uuid();
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
});
export function pageMeta(page: number, limit: number, total: number) {
  return { page, limit, total, total_pages: Math.ceil(total / limit) };
}
