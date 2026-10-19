import { it, expect } from 'vitest';
import { RateLimitWindow } from './rate-limit';

it('blocks the eleventh recovery attempt for the same address within ten minutes', () => {
  const limiter = new RateLimitWindow(10, 600000);
  for (let n = 0; n < 10; n++) expect(limiter.allow('ip:127.0.0.1', 1000)).toBe(true);
  expect(limiter.allow('ip:127.0.0.1', 1000)).toBe(false);
});
