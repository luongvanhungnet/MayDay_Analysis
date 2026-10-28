import { expect, it } from 'vitest';
import { parallelInference } from './parallel';
it('starts both models before waiting, preserving separate results', async () => {
  const started: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const run = (id: string) => async () => {
    started.push(id); await gate; return { id, detections: [] };
  };
  const pending = parallelInference(run('lesions'), run('skin'));
  expect(started).toEqual(['lesions', 'skin']);
  release();
  expect((await pending).models.map(x => x.id)).toEqual(['lesions', 'skin']);
});
it('flags disagreement and never calls no detections healthy', async () => {
  const lesion = { label: 'Single', confidence: 0.6, xyxy: [0, 0, 10, 10] };
  const normal = { label: 'normal skin', confidence: 0.8, xyxy: [0, 0, 20, 20] };
  expect((await parallelInference(async () => ({ id: 'lesions', detections: [lesion] }), async () => ({ id: 'skin', detections: [normal] }))).status).toBe('conflicting');
  expect((await parallelInference(async () => ({ id: 'lesions', detections: [] }), async () => ({ id: 'skin', detections: [] }))).status).toBe('uncertain');
});
it('rejects the combined result when either model fails', async () => {
  await expect(parallelInference(async () => { throw new Error('missing model'); }, async () => ({ id: 'skin', detections: [] }))).rejects.toThrow('missing model');
});

it('starts a third counting worker and returns its result independently', async () => {
  const started: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const worker = (id: string) => async () => { started.push(id); await gate; return { id, detections: [] }; };
  const pending = parallelInference(worker('lesions'), worker('skin'), worker('counting'));
  release();
  const result = await pending;
  expect(started).toEqual(['lesions', 'skin', 'counting']);
  expect(result.models).toHaveLength(3);
});
