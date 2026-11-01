import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { endpoints } from './catalog';

it('accounts for every distinct API operation in the specification, including grouped operations', () => {
  const text = readFileSync(resolve(__dirname, '../../../../docs/MayDay.md'), 'utf8');
  const names = [...new Set(text.split(/\r?\n/)
    .filter(line => line.startsWith('#### ') && !/^#### (Mô tả|Các test case|Danh sách API|Thank)/.test(line))
    .map(line => line.slice(5).replace(/\s*\((input|output)\)\s*$/, '').trim()))];
  expect(endpoints.map(e => e.source).sort()).toEqual(names.sort());
  expect(new Set(endpoints.map(e => `${e.method} ${e.path}`)).size).toBe(92);
});
