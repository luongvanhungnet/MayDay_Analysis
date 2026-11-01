export interface Detection { label: string; confidence: number; xyxy: number[] }
export interface ModelResult { id: string; detections: Detection[]; width?: number; height?: number; elapsed_ms?: number }
export async function parallelInference(a: () => Promise<ModelResult>, b: () => Promise<ModelResult>, c?: () => Promise<ModelResult>) {
  // Wait for both workers even if one fails, so capacity is not released prematurely.
  const settled = await Promise.allSettled([a(), b(), ...(c ? [c()] : [])]);
  const failed = settled.find(x => x.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
  const models = settled.map(x => (x as PromiseFulfilledResult<ModelResult>).value);
  const lesions = models[0].detections.some(x => ['Single', 'Multiple'].includes(x.label));
  const normal = models[1].detections.some(x => x.label === 'normal skin');
  const urticaria = models[1].detections.some(x => x.label === 'urticaria');
  return { models, status: normal && (lesions || urticaria) ? 'conflicting' : urticaria && lesions ? 'concordant' : 'uncertain',
    interpretation: 'experimental_detection_only', confidence_threshold: 0.25 };
}
