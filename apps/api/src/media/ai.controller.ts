import { Controller, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { Actor, CurrentUser } from '../auth/current-user.decorator';
import { RequirePermission } from '../auth/access.decorator';
import { RecordAccessService } from '../clinical/record-access.service';
import { DomainException } from '../common/domain.exception';
import { PrismaService } from '../common/prisma.service';
import { parse, uuid } from '../common/validation';
import { MediaService } from './media.service';

@Controller('lesion-photos')
export class AiController {
  constructor(private readonly db: PrismaService, private readonly media: MediaService, private readonly access: RecordAccessService) {}
  @Post(':id/predict') @RequirePermission('media.write') async predict(@CurrentUser() actor: Actor, @Param('id') id: string) {
    parse(uuid, id);
    const photo = await this.db.lesionPhoto.findUnique({ where: { id }, include: { location: { include: { episode: true } } } });
    if (!photo) throw new DomainException(7003, 'Lesion photo not found', 404);
    await this.access.assertRecord(actor, photo.location.episode.medical_record_id, { write: true });
    if (!process.env.AI_SERVICE_URL) throw new DomainException(8001, 'AI provider is not configured', 503);
    const { media, stream } = await this.media.content(actor, photo.media_id);
    const chunks: Buffer[] = []; for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const form = new FormData(); form.append('image', new Blob([new Uint8Array(Buffer.concat(chunks))], { type: media.mime_type }), media.file_name);
    let response: unknown;
    try { const result = await fetch(`${process.env.AI_SERVICE_URL.replace(/\/$/, '')}/predict`, { method: 'POST', body: form, signal: AbortSignal.timeout(5000) }); if (!result.ok) throw new Error('Provider rejected request'); response = await result.json(); }
    catch { throw new DomainException(8002, 'AI provider timed out or is unavailable', 503); }
    const result = parse(z.object({ hives_count: z.number().int().min(0).max(100000), local_auas: z.number().min(0).optional(), confidence: z.number().min(0).max(1).optional() }).strict(), response);
    return this.access.withRecordWrite(actor, photo.location.episode.medical_record_id, tx => tx.lesionPhoto.update({ where: { id }, data: { ai_result: result as Prisma.InputJsonValue, hives_count: result.hives_count, local_auas: result.local_auas } }));
  }
}
