import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { ObjectStorage } from './object-storage';
import { Actor } from '../auth/current-user.decorator';
import { RecordAccessService } from '../clinical/record-access.service';
import { DomainException } from '../common/domain.exception';
import { PrismaService } from '../common/prisma.service';
import { parse, uuid } from '../common/validation';
import { z } from 'zod';
import { detectImage } from './image-contract';

@Injectable()
export class MediaService implements OnModuleInit {
  private readonly logger = new Logger(MediaService.name);
  private readonly bucket = process.env.MINIO_BUCKET ?? 'mayday-private';
  private readonly storage = new ObjectStorage();
  constructor(private readonly db: PrismaService, private readonly access: RecordAccessService) {}
  async onModuleInit() {
    try { if (!await this.storage.bucketExists(this.bucket)) await this.storage.makeBucket(this.bucket); }
    catch { this.logger.warn('Media storage unavailable; uploads return a service error until MinIO is ready.'); }
  }
  async upload(actor: Actor, files: Express.Multer.File[]) {
    if (!files?.length) throw new DomainException(6001, 'Image file is required');
    if (files.length > 10) throw new DomainException(6003, 'Maximum 10 images per upload');
    const validated = files.map(file => {
      if (file.size > 5 * 1024 * 1024) throw new DomainException(6003, 'File size exceeds 5 MB limit', 413);
      const mime = detectImage(file.buffer);
      if (!mime) throw new DomainException(6002, 'Only genuine JPEG, PNG and WebP images are accepted');
      return { file, mime };
    });
    const stored: string[] = [];
    const metadata: { id: string; uploaded_by: string; storage_key: string; file_name: string; file_size: number; mime_type: string; url: string }[] = [];
    try {
      for (const { file, mime } of validated) {
        const id = randomUUID(); const key = `${actor.id}/${id}`;
        await this.storage.putObject(this.bucket, key, file.buffer, file.size, { 'Content-Type': mime });
        stored.push(key);
        metadata.push({ id, uploaded_by: actor.id, storage_key: key, file_name: basename(file.originalname).slice(0, 200), file_size: file.size, mime_type: mime, url: `/api/v1/image-attachments/${id}/content` });
      }
      return await this.db.$transaction(metadata.map(data => this.db.mediaAttachment.create({ data })));
    } catch (error) {
      await Promise.allSettled(stored.map(key => this.storage.removeObject(this.bucket, key)));
      this.logger.error('Image upload failed');
      throw new DomainException(6004, 'Image storage is unavailable. Please try again.', 503);
    }
  }
  async list(actor: Actor, user_id: string) {
    parse(uuid, user_id);
    if (actor.id !== user_id) await this.access.assertPatient(actor, user_id);
    // Listing only reveals metadata; each binary fetch checks record-level access.
    if (actor.id !== user_id && actor.role !== 'admin') {
      return this.db.mediaAttachment.findMany({ where: { uploaded_by: user_id, OR: [
        { answer_images: { some: { answer: { medical_record: { assigned_doctor_id: actor.id } } } } },
        { lesion_photos: { some: { location: { episode: { medical_record: { assigned_doctor_id: actor.id } } } } } },
        { lab_results: { some: { item: { lab_request: { medical_record: { assigned_doctor_id: actor.id } } } } } },
      ] }, orderBy: { created_at: 'desc' }, take: 100 });
    }
    return this.db.mediaAttachment.findMany({ where: { uploaded_by: user_id }, orderBy: { created_at: 'desc' }, take: 100 });
  }
  private async authorized(actor: Actor, id: string) {
    parse(uuid, id);
    const media = await this.db.mediaAttachment.findUnique({ where: { id }, include: { answer_images: { include: { answer: { select: { medical_record_id: true } } } }, lesion_photos: { include: { location: { include: { episode: { select: { medical_record_id: true } } } } } }, lab_results: { include: { item: { include: { lab_request: { select: { medical_record_id: true } } } } } } } });
    if (!media) throw new DomainException(6005, 'Attachment not found', 404);
    if (media.uploaded_by === actor.id || actor.role === 'admin') return media;
    const records = [...media.answer_images.map(i => i.answer.medical_record_id), ...media.lesion_photos.map(p => p.location.episode.medical_record_id), ...media.lab_results.map(r => r.item.lab_request.medical_record_id)];
    for (const recordId of records) { try { await this.access.assertRecord(actor, recordId); return media; } catch { /* Try other linked records. */ } }
    throw new DomainException(3106, 'Cannot access another user\'s image', 403);
  }
  async content(actor: Actor, id: string) {
    const media = await this.authorized(actor, id);
    try { return { media, stream: await this.storage.getObject(this.bucket, media.storage_key) }; }
    catch { throw new DomainException(6004, 'Image storage unavailable', 503); }
  }
  async remove(actor: Actor, id: string) {
    const media = await this.authorized(actor, id);
    if (media.uploaded_by !== actor.id && actor.role !== 'admin') throw new DomainException(3106, 'Only the uploader may delete an image', 403);
    return this.db.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM media_attachments WHERE id = ${id}::uuid FOR UPDATE`);
      const current = await tx.mediaAttachment.findUnique({ where: { id }, include: { _count: { select: { answer_images: true, lesion_photos: true, lab_results: true } } } });
      if (!current) throw new DomainException(6005, 'Attachment not found', 404);
      if (Object.values(current._count).some(count => count > 0)) throw new DomainException(6007, 'Image is linked to clinical data. Remove its links before deleting.', 409);
      await tx.mediaAttachment.delete({ where: { id } });
      try { await this.storage.removeObject(this.bucket, current.storage_key); }
      catch { throw new DomainException(6004, 'Image storage unavailable', 503); }
      return { id };
    }, { timeout: 15_000 });
  }
  async attach(actor: Actor, raw: unknown) {
    const input = parse(z.object({ answer_id: uuid, attachment_id: uuid.optional(), media_id: uuid.optional(), option_value: z.string().max(200).optional() }).strict().refine(v => v.attachment_id || v.media_id, 'attachment_id is required'), raw);
    const answer = await this.db.answer.findUnique({ where: { id: input.answer_id } });
    if (!answer) throw new DomainException(4001, 'Answer not found', 404);
    const media_id = input.attachment_id ?? input.media_id!;
    const media = await this.authorized(actor, media_id);
    return this.access.withRecordWrite(actor, answer.medical_record_id, async (tx, record) => {
      if (media.uploaded_by !== actor.id && media.uploaded_by !== record.patient_id) throw new DomainException(3106, 'Attachment uploader must belong to this record', 403);
      if (await tx.answerImage.findUnique({ where: { answer_id_media_id: { answer_id: answer.id, media_id } } })) throw new DomainException(6006, 'Image already mapped to answer', 409);
      return tx.answerImage.create({ data: { answer_id: answer.id, media_id, option_value: input.option_value }, include: { media: true } });
    });
  }
  async answerImages(actor: Actor, answer_id: string) {
    parse(uuid, answer_id); const answer = await this.db.answer.findUnique({ where: { id: answer_id } });
    if (!answer) throw new DomainException(4001, 'Answer not found', 404);
    await this.access.assertRecord(actor, answer.medical_record_id);
    return this.db.answerImage.findMany({ where: { answer_id }, include: { media: true } });
  }
  async detach(actor: Actor, id: string) {
    parse(uuid, id); const link = await this.db.answerImage.findUnique({ where: { id }, include: { answer: true } });
    if (!link) throw new DomainException(6005, 'Image mapping not found', 404);
    return this.access.withRecordWrite(actor, link.answer.medical_record_id, async tx => { await tx.answerImage.delete({ where: { id } }); return { id }; });
  }
}
