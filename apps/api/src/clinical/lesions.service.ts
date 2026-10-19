import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { Actor } from '../auth/current-user.decorator';
import { DomainException } from '../common/domain.exception';
import { PrismaService } from '../common/prisma.service';
import { parse } from '../common/validation';
import * as dto from './clinical.dto';
import { RecordAccessService } from './record-access.service';

const episodeTree = { locations: { include: { photos: { include: { media: true }, orderBy: { captured_at: 'asc' as const } } } } } satisfies Prisma.LesionEpisodeInclude;
function input<S extends z.ZodTypeAny>(schema: S, raw: unknown, code: number): z.output<S> {
  const result = schema.safeParse(raw);
  if (!result.success) throw new DomainException(code, result.error.issues[0].message);
  return result.data;
}

@Injectable()
export class LesionsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(RecordAccessService) private readonly access: RecordAccessService) {}

  async createEpisode(actor: Actor, raw: unknown) {
    if (actor.role !== 'patient') throw new DomainException(3101, 'Patient role required', 403);
    const data = input(dto.createEpisodeDto, raw, 7004);
    return this.access.withRecordWrite(actor, data.medical_record_id, async (client, record) => {
      const { medical_record_id, started_at, ended_at, ...fields } = data;
      const start = started_at ? new Date(started_at) : new Date();
      const end = ended_at ? new Date(ended_at) : null;
      if (end && end < start) throw new DomainException(2003, 'Episode end cannot precede its start');
      const episode = await client.lesionEpisode.create({ data: { ...fields, medical_record_id, patient_id: record.patient_id, started_at: start, ended_at: end }, include: episodeTree });
      return { ...episode, episode_id: episode.id };
    });
  }

  async myEpisodes(actor: Actor) {
    if (actor.role !== 'patient') throw new DomainException(3101, 'Patient role required', 403);
    const active = await this.prisma.medicalRecord.findFirst({ where: { patient_id: actor.id, status: { in: ['pending', 'in_progress'] } }, select: { id: true } });
    if (!active) throw new DomainException(4002, 'Active medical record required', 409);
    return this.prisma.lesionEpisode.findMany({ where: { patient_id: actor.id }, include: episodeTree, orderBy: { started_at: 'desc' } });
  }

  async recordEpisodes(actor: Actor, recordId: string) {
    await this.access.assertRecord(actor, recordId);
    return this.prisma.lesionEpisode.findMany({ where: { medical_record_id: recordId }, include: episodeTree, orderBy: { started_at: 'desc' } });
  }

  async patientEpisodes(actor: Actor, patientId: string) {
    await this.access.assertPatient(actor, patientId);
    return this.prisma.lesionEpisode.findMany({ where: { patient_id: patientId, ...(actor.role !== 'patient' && actor.role !== 'admin' ? { medical_record: { assigned_doctor_id: actor.id } } : {}) }, include: episodeTree, orderBy: { started_at: 'desc' } });
  }

  async episode(actor: Actor, episodeId: string) {
    const episode = await this.findEpisode(episodeId);
    await this.access.assertRecord(actor, episode.medical_record_id);
    return this.prisma.lesionEpisode.findUniqueOrThrow({ where: { id: episode.id }, include: episodeTree });
  }

  async updateEpisode(actor: Actor, episodeId: string, raw: unknown) {
    const data = input(dto.updateEpisodeDto, raw, 7004);
    const episode = await this.findEpisode(episodeId);
    return this.access.withRecordWrite(actor, episode.medical_record_id, async client => {
      const existing = await this.findEpisode(episodeId, client);
      const { started_at, ended_at, ...fields } = data;
      const start = started_at ? new Date(started_at) : existing.started_at;
      const end = ended_at === null ? null : ended_at ? new Date(ended_at) : existing.ended_at;
      if (end && end < start) throw new DomainException(2003, 'Episode end cannot precede its start');
      return client.lesionEpisode.update({ where: { id: episodeId }, data: { ...fields, started_at: start, ended_at: end }, include: episodeTree });
    });
  }

  async deleteEpisode(actor: Actor, episodeId: string) {
    const episode = await this.findEpisode(episodeId);
    return this.access.withRecordWrite(actor, episode.medical_record_id, async client => {
      await this.findEpisode(episodeId, client);
      await client.lesionEpisode.delete({ where: { id: episodeId } });
      return { deleted: true };
    });
  }

  async createLocation(actor: Actor, raw: unknown) {
    const data = input(dto.createLocationDto, raw, 7005);
    const episode = await this.findEpisode(data.episode_id);
    return this.access.withRecordWrite(actor, episode.medical_record_id, async client => {
      await this.findEpisode(episode.id, client);
      return client.lesionLocation.create({ data, include: { photos: { include: { media: true } } } });
    });
  }

  async locations(actor: Actor, episodeId: string) {
    const episode = await this.findEpisode(episodeId);
    await this.access.assertRecord(actor, episode.medical_record_id);
    return this.prisma.lesionLocation.findMany({ where: { episode_id: episodeId }, include: { photos: { include: { media: true }, orderBy: { captured_at: 'asc' } } } });
  }

  async updateLocation(actor: Actor, locationId: string, raw: unknown) {
    const data = input(dto.updateLocationDto, raw, 7005);
    const location = await this.findLocation(locationId);
    return this.access.withRecordWrite(actor, location.episode.medical_record_id, async client => {
      await this.findLocation(locationId, client);
      return client.lesionLocation.update({ where: { id: locationId }, data });
    });
  }

  async deleteLocation(actor: Actor, locationId: string) {
    const location = await this.findLocation(locationId);
    return this.access.withRecordWrite(actor, location.episode.medical_record_id, async client => {
      await this.findLocation(locationId, client);
      await client.lesionLocation.delete({ where: { id: locationId } });
      return { deleted: true };
    });
  }

  async createPhoto(actor: Actor, raw: unknown) {
    const parsed = dto.createPhotoDto.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const code = ['stage', 'milestone'].includes(String(issue.path[0])) || issue.message.includes('Milestone') ? 7006 : issue.path.some(path => String(path).endsWith('_score')) ? 7007 : 2003;
      throw new DomainException(code, issue.message);
    }
    const data = parsed.data;
    const location = await this.findLocation(data.location_id);
    return this.access.withRecordWrite(actor, location.episode.medical_record_id, async (client, record) => {
      await this.findLocation(location.id, client);
      const media_id = data.media_id ?? data.attachment_id!;
      const media = await client.mediaAttachment.findFirst({ where: { id: media_id, uploaded_by: { in: [actor.id, record.patient_id] } } });
      if (!media) throw new DomainException(6005, 'Attachment not found or not owned by this patient', 403);
      if (!media.mime_type.startsWith('image/')) throw new DomainException(6002, 'An image attachment is required');
      return client.lesionPhoto.create({ data: { location_id: location.id, media_id, stage: data.stage ?? data.milestone!, itch_score: data.itch_score, pain_score: data.pain_score, burning_score: data.burning_score ?? data.burn_score ?? 0, hives_count: data.hives_count, captured_at: data.captured_at ? new Date(data.captured_at) : undefined }, include: { media: true } });
    });
  }

  async photos(actor: Actor, locationId: string) {
    const location = await this.findLocation(locationId);
    await this.access.assertRecord(actor, location.episode.medical_record_id);
    return this.prisma.lesionPhoto.findMany({ where: { location_id: locationId }, include: { media: true }, orderBy: { captured_at: 'asc' } });
  }

  async updatePhotoMilestone(actor: Actor, photoId: string, raw: unknown) {
    const data = input(dto.updateMilestoneDto, raw, 7006);
    const photo = await this.findPhoto(photoId);
    return this.access.withRecordWrite(actor, photo.location.episode.medical_record_id, async client => {
      await this.findPhoto(photoId, client);
      return client.lesionPhoto.update({ where: { id: photoId }, data: { stage: data.stage ?? data.milestone }, include: { media: true } });
    });
  }

  async deletePhoto(actor: Actor, photoId: string) {
    const photo = await this.findPhoto(photoId);
    return this.access.withRecordWrite(actor, photo.location.episode.medical_record_id, async client => {
      await this.findPhoto(photoId, client);
      await client.lesionPhoto.delete({ where: { id: photoId } });
      return { deleted: true };
    });
  }

  private async findEpisode(episodeId: string, client: Prisma.TransactionClient = this.prisma) {
    const episode = await client.lesionEpisode.findUnique({ where: { id: parse(dto.id, episodeId) } });
    if (!episode) throw new DomainException(7001, 'Lesion episode not found', 404);
    return episode;
  }
  private async findLocation(locationId: string, client: Prisma.TransactionClient = this.prisma) {
    const location = await client.lesionLocation.findUnique({ where: { id: parse(dto.id, locationId) }, include: { episode: true } });
    if (!location) throw new DomainException(7002, 'Lesion location not found', 404);
    return location;
  }
  private async findPhoto(photoId: string, client: Prisma.TransactionClient = this.prisma) {
    const photo = await client.lesionPhoto.findUnique({ where: { id: parse(dto.id, photoId) }, include: { location: { include: { episode: true } } } });
    if (!photo) throw new DomainException(7003, 'Lesion photo not found', 404);
    return photo;
  }
}
