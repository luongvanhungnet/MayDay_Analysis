import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { Actor } from '../auth/current-user.decorator';
import { DomainException } from '../common/domain.exception';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { parse, uuid } from '../common/validation';
import { reminderId } from './reminder';

const settingsSchema = z.object({ push_enabled: z.boolean().optional(), sound_enabled: z.boolean().optional(), uas7_reminder: z.boolean().optional(), medication_reminder: z.boolean().optional(), appointment_enabled: z.boolean().optional(), lab_results_enabled: z.boolean().optional(), prescriptions_enabled: z.boolean().optional(), reminder_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional() }).strict();
export interface ClinicalNotification { user_id: string; type: string; title: string; body: string; medical_record_id?: string; notification_id?: string }

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private timer?: NodeJS.Timeout;
  private firebaseReady = false;
  private delivering = false;
  private scheduling = false;
  constructor(private readonly db: PrismaService, private readonly redis: RedisService) {}
  onModuleInit() {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const credential = JSON.parse(readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
      if (!getApps().length) initializeApp({ credential: cert(credential) }); this.firebaseReady = true;
    }
    this.timer = setInterval(() => { void this.scheduleReminders(); if (this.firebaseReady) void this.retryPending(); }, 30_000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  list(actor: Actor) { return this.db.notification.findMany({ where: { user_id: actor.id }, orderBy: { created_at: 'desc' }, take: 100 }); }
  async read(actor: Actor, id: string) {
    parse(uuid, id);
    const updated = await this.db.notification.updateMany({ where: { id, user_id: actor.id }, data: { is_read: true } });
    if (!updated.count) throw new DomainException(9102, 'Notification not found', 404);
    return this.db.notification.findUnique({ where: { id } });
  }
  async remove(actor: Actor, id: string) {
    parse(uuid, id);
    const deleted = await this.db.notification.deleteMany({ where: { id, user_id: actor.id } });
    if (!deleted.count) throw new DomainException(9102, 'Notification not found', 404); return { id };
  }
  settings(actor: Actor) { return this.db.userNotificationSetting.upsert({ where: { user_id: actor.id }, create: { user_id: actor.id }, update: {} }); }
  updateSettings(actor: Actor, raw: unknown) {
    const data = parse(settingsSchema, raw);
    return this.db.userNotificationSetting.upsert({ where: { user_id: actor.id }, create: { user_id: actor.id, ...data }, update: data });
  }
  async register(actor: Actor, raw: unknown) {
    const data = parse(z.object({ fcm_token: z.string().min(10).max(4096), device_id: z.string().min(1).max(200).optional(), platform: z.enum(['web', 'android', 'ios']).default('web') }).strict(), raw);
    try { return await this.db.userFcmToken.create({ data: { user_id: actor.id, token: data.fcm_token, platform: data.platform, device_id: data.device_id } }); }
    catch (error) { if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error; }
    const updated = await this.db.userFcmToken.updateMany({ where: { token: data.fcm_token, user_id: actor.id }, data: { platform: data.platform, device_id: data.device_id } });
    if (!updated.count) throw new DomainException(3106, 'Device token already registered by another user', 403);
    return this.db.userFcmToken.findUnique({ where: { token: data.fcm_token } });
  }
  @OnEvent('clinical.notification', { async: true })
  async onClinicalEvent(event: ClinicalNotification) {
    try {
      const data: Prisma.InputJsonValue = event.medical_record_id ? { medical_record_id: event.medical_record_id } : {};
      const notification = event.notification_id ? await this.db.notification.findUniqueOrThrow({ where: { id: event.notification_id } }) : await this.db.notification.create({ data: { user_id: event.user_id, type: event.type, title: event.title, body: event.body, data, delivery_status: this.firebaseReady ? 'pending' : 'provider_not_configured' } });
      if (!this.firebaseReady && notification.delivery_status === 'pending') await this.db.notification.update({ where: { id: notification.id }, data: { delivery_status: 'provider_not_configured' } });
      if (this.firebaseReady) await this.deliver(notification.id);
    } catch { this.logger.error('Could not persist clinical notification'); }
  }
  private async retryPending() {
    if (this.delivering) return; this.delivering = true;
    try { const pending = await this.db.notification.findMany({ where: { delivery_status: 'pending' }, select: { id: true }, take: 50 }); for (const row of pending) await this.deliver(row.id); }
    catch { this.logger.warn('Notification retry deferred'); }
    finally { this.delivering = false; }
  }
  /** Clinic timezone; durable IDs provide at-most-one daily reminder per patient and kind. */
  async scheduleReminders(now = new Date()) {
    if (this.scheduling) return; this.scheduling = true;
    try {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
      const part = (type: string) => parts.find(p => p.type === type)!.value;
      const date = `${part('year')}-${part('month')}-${part('day')}`;
      const time = `${part('hour')}:${part('minute')}`;
      const patients = await this.db.patient.findMany({ where: { user: { is_active: true, notification_setting: { reminder_time: { lte: time } } } }, select: { user_id: true, user: { select: { notification_setting: true } }, uas7_scores: { where: { score_date: new Date(`${date}T00:00:00.000Z`) }, select: { id: true } }, medical_records: { where: { status: 'in_progress', prescriptions: { some: {} } }, select: { id: true }, take: 1 } } });
      for (const patient of patients) {
        const setting = patient.user.notification_setting;
        const reminders = [
          ...(setting?.uas7_reminder && !patient.uas7_scores.length ? [{ kind: 'uas7' as const, title: 'Nhắc ghi UAS7', body: 'Hãy ghi điểm ngứa và sẩn phù hôm nay để theo dõi diễn biến.' }] : []),
          ...(setting?.medication_reminder && patient.medical_records.length ? [{ kind: 'medication' as const, title: 'Nhắc theo dõi điều trị', body: 'Kiểm tra đơn thuốc và thực hiện theo hướng dẫn của bác sĩ.' }] : []),
        ];
        for (const reminder of reminders) {
          const id = reminderId(patient.user_id, date, reminder.kind);
          try {
            await this.db.notification.create({ data: { id, user_id: patient.user_id, type: reminder.kind, title: reminder.title, body: reminder.body, data: { date }, delivery_status: this.firebaseReady ? 'pending' : 'provider_not_configured' } });
            if (this.firebaseReady) await this.deliver(id);
          } catch (error) { if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error; }
        }
      }
    } catch { this.logger.warn('Daily reminders deferred'); }
    finally { this.scheduling = false; }
  }
  private async deliver(id: string) {
    const lock = `notification:delivery:${id}`;
    let claimed = false;
    try { claimed = await this.redis.client.set(lock, '1', 'EX', 60, 'NX') === 'OK'; } catch { return; }
    if (!claimed) return;
    try { await this.deliverClaimed(id); }
    finally { await this.redis.del(lock); }
  }
  private async deliverClaimed(id: string) {
    const row = await this.db.notification.findUnique({ where: { id }, include: { user: { include: { notification_setting: true, fcm_tokens: true } } } });
    if (!row || row.delivery_status !== 'pending') return;
    const setting = row.user.notification_setting;
    const enabled = setting?.push_enabled !== false && !(row.type === 'lab_result' && setting?.lab_results_enabled === false) && !(row.type === 'prescription' && setting?.prescriptions_enabled === false) && !(row.type === 'uas7' && setting?.uas7_reminder === false) && !(row.type === 'medication' && setting?.medication_reminder === false);
    if (!enabled) { await this.db.notification.update({ where: { id }, data: { delivery_status: 'muted' } }); return; }
    if (!row.user.fcm_tokens.length) { await this.db.notification.update({ where: { id }, data: { delivery_status: 'no_device' } }); return; }
    try {
      const result = await getMessaging().sendEachForMulticast({ tokens: row.user.fcm_tokens.map(t => t.token).slice(0, 100), notification: { title: row.title, body: row.body }, data: { notification_id: id, type: row.type } });
      const invalid = result.responses.flatMap((res, index) => res.error?.code === 'messaging/registration-token-not-registered' || res.error?.code === 'messaging/invalid-registration-token' ? [row.user.fcm_tokens[index].id] : []);
      if (invalid.length) await this.db.userFcmToken.deleteMany({ where: { id: { in: invalid } } });
      const transientFailures = result.failureCount > invalid.length;
      await this.db.notification.update({ where: { id }, data: { delivery_status: transientFailures ? 'pending' : result.successCount ? 'sent' : 'no_device', sent_at: result.successCount ? new Date() : null } });
    } catch { this.logger.warn('FCM unavailable; persisted notification will retry'); }
  }
}
