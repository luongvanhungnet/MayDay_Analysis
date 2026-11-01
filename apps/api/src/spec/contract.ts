import { HttpException } from '@nestjs/common';
import { z } from 'zod';
import type { Actor } from '../native/schema';
import type { Endpoint } from './catalog';

export const objectInput = z.record(z.unknown());
export const idInput = z.union([z.string().regex(/^[1-9]\d*$/), z.number().int().positive().max(Number.MAX_SAFE_INTEGER)])
  .transform(String).refine(v => BigInt(v) <= 9223372036854775807n, 'Mã vượt giới hạn bigint');
export interface Upload { originalname: string; mimetype: string; buffer: Buffer; }
export interface SpecRequest {
  endpoint: Endpoint;
  actor?: Actor;
  params: Record<string,string>;
  query: Record<string,unknown>;
  body: unknown;
  authorization?: string;
  ip?: string;
  file?: Upload;
}
export type SpecResult = { ok: true; data: unknown } | { ok: false; error: HttpException };
export interface SpecHandler { execute(request: SpecRequest): Promise<SpecResult>; }
