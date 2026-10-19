import { expect, test } from 'vitest';
import { detectImage } from './image-contract';
test('rejects scripts and SVG content even when named as a JPEG image', () => {
  expect(detectImage(Buffer.from('<svg onload="alert(1)"></svg>'))).toBeNull();
});
