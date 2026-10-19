import { it, expect } from 'vitest';
import { z } from 'zod';
import { parse } from './validation';
import { DomainException } from './domain.exception';

it('returns specification error 2001 for a missing required parameter', () => {
  try { parse(z.object({ full_name: z.string() }), {}); throw new Error('Expected validation error'); }
  catch (error) { expect(error).toBeInstanceOf(DomainException); expect((error as DomainException).code).toBe(2001); }
});
