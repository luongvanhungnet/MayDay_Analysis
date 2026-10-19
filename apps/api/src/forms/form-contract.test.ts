import { expect, test } from 'vitest';
import { hasParentCycle, isValidScreeningQuestion } from './form-contract';

test('rejects assigning a descendant as parent, preventing a conditional form cycle', () => {
  expect(hasParentCycle('root', 'grandchild', new Map([['child', 'root'], ['grandchild', 'child']]))).toBe(true);
});

test('screening uses unconditional single-choice questions so every answer can select a routing rule', () => {
  expect(isValidScreeningQuestion('classification', 'text', null)).toBe(false);
  expect(isValidScreeningQuestion('classification', 'radio', 'parent')).toBe(false);
  expect(isValidScreeningQuestion('classification', 'radio', null)).toBe(true);
  expect(isValidScreeningQuestion('clinical', 'text', null)).toBe(true);
});
