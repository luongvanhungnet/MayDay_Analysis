import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MedicalRecord, Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { Actor } from '../auth/current-user.decorator';
import { DomainException } from '../common/domain.exception';
import { PrismaService } from '../common/prisma.service';
import { parse } from '../common/validation';
import * as dto from './clinical.dto';
import { ClassificationHandler, ClassificationRule, ConditionalMatchHandler, ConditionalMatchInput, RecordPolicyHandler, UasWeekHandler } from './contracts';
import { RecordAccessService } from './record-access.service';

const userSummary = { id: true, full_name: true, phone: true } satisfies Prisma.UserSelect;
const patientSummary = { user_id: true, year_of_birth: true, gender: true, address: true, user: { select: userSummary } } satisfies Prisma.PatientSelect;
const queuePatientSummary = { user_id: true, user: { select: userSummary } } satisfies Prisma.PatientSelect;
const templateTree = { sections: { orderBy: { order: 'asc' as const }, include: { questions: { orderBy: { order: 'asc' as const }, include: { options: { orderBy: { order: 'asc' as const } } } } } } } satisfies Prisma.TemplateInclude;
const answerTree = { question: true, images: { include: { media: true } } } satisfies Prisma.AnswerInclude;
const episodeTree = { locations: { include: { photos: { include: { media: true }, orderBy: { captured_at: 'asc' as const } } } } } satisfies Prisma.LesionEpisodeInclude;
type ClinicalQuestion = Prisma.QuestionGetPayload<{ include: { options: true; section: true } }>;

function schemaParse<S extends z.ZodTypeAny>(schema: S, raw: unknown, code?: number | ((issue: z.ZodIssue) => number)): z.output<S> {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  throw new DomainException(typeof code === 'function' ? code(issue) : code ?? 2003, `${issue.path.join('.') || 'request'}: ${issue.message}`);
}
function policy(actor: Actor, record: MedicalRecord, action: 'read' | 'edit' | 'accept' | 'complete') {
  const result = new RecordPolicyHandler().execute({ actor, record: { ...record, status: record.status as 'pending' | 'in_progress' | 'completed' }, action });
  if (!result.success) throw new DomainException(result.error.code, result.error.message, [3101, 3105, 3106].includes(result.error.code) ? 403 : 409);
}
function answerView<T extends { value: Prisma.JsonValue }>(answer: T) { return { ...answer, answer_value: answer.value }; }
function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }

@Injectable()
export class ClinicalService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(RecordAccessService) private readonly access: RecordAccessService, @Inject(EventEmitter2) private readonly events: EventEmitter2) {}

  async classifyQuestions() {
    const questions = await this.screeningQuestions();
    if (!questions.length) throw new DomainException(4101, 'No active classification questionnaire configured', 404);
    return questions.map(question => ({ id: question.id, question_id: question.id, content: question.content, question_text: question.content, type_question: question.type_question, options: question.options.map(option => ({ ...option, option_text: option.label, option_value: option.value })) }));
  }

  private screeningQuestions() {
    return this.prisma.question.findMany({ where: { section: { template: { is_active: true, kind: 'classification' } } }, include: { options: { orderBy: { order: 'asc' } } }, orderBy: [{ section: { order: 'asc' } }, { order: 'asc' }, { id: 'asc' }] });
  }

  async classify(raw: unknown) {
    const input = schemaParse(dto.classifyDto, raw, 4006);
    const questions = await this.screeningQuestions();
    if (!questions.length) throw new DomainException(4101, 'No active classification questionnaire configured', 404);
    const incoming: { question_id: string; value?: string; option_value?: string; option_id?: string; question_option_id?: string }[] = 'answers' in input ? input.answers : [
      { question_id: '30000000-0000-4000-8000-000000000022', value: input.has_previous_visit ? 'yes' : 'no' },
      { question_id: '30000000-0000-4000-8000-000000000023', value: input.has_chronic_urticaria ? 'yes' : 'no' },
    ];
    if (incoming.length !== questions.length || incoming.some(answer => !questions.some(question => question.id === answer.question_id))) throw new DomainException(4006, 'Classification options incomplete');
    const answers: Record<string, string> = {};
    for (const answer of incoming) {
      const question = questions.find(question => question.id === answer.question_id)!;
      const option_id = answer.option_id ?? answer.question_option_id;
      const option_value = answer.option_value ?? answer.value;
      if (answer.option_value !== undefined && answer.value !== undefined && answer.option_value !== answer.value) throw new DomainException(4006, 'Conflicting classification option values');
      const option = question.options.find(option => option_id ? option.id === option_id : option.value === option_value);
      if (!option || option_value !== undefined && option.value !== option_value) throw new DomainException(4006, 'Classification option does not belong to question');
      answers[question.id] = option.value;
    }
    const templates = await this.prisma.template.findMany({ where: { is_active: true, kind: 'clinical', classification_rules: { not: Prisma.DbNull } }, include: templateTree, orderBy: { id: 'asc' } });
    const choices = templates.map(template => ({ id: template.id, rules: schemaParse(ClassificationRule, template.classification_rules, 4101) }));
    const selected = new ClassificationHandler().execute({ answers, templates: choices });
    if (!selected.success) throw new DomainException(selected.error.code, selected.error.message, 404);
    const template = templates.find(template => template.id === selected.template_id)!;
    return { template_id: template.id, template };
  }

  async searchPatients(actor: Actor, query: Record<string, unknown>) {
    this.access.requireStaff(actor);
    const input = schemaParse(z.object({ search: z.string().trim().max(200).default(''), q: z.string().trim().max(200).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25) }), query);
    const search = input.q ?? input.search;
    const where: Prisma.PatientWhereInput = { user: { is_active: true, OR: [{ full_name: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] } };
    const [data, total] = await Promise.all([this.prisma.patient.findMany({ where, select: patientSummary, orderBy: { user: { full_name: 'asc' } }, skip: (input.page - 1) * input.limit, take: input.limit }), this.prisma.patient.count({ where })]);
    const items = data.map(patient => ({ ...patient, id: patient.user_id }));
    return { items, data: items, meta: { page: input.page, limit: input.limit, total, total_pages: Math.ceil(total / input.limit) } };
  }

  async createPatient(actor: Actor, raw: unknown) {
    this.access.requireStaff(actor);
    const input = schemaParse(dto.createPatientDto, raw);
    const { full_name, phone, email, password, ...profile } = input;
    const temporary_password = password ?? randomBytes(12).toString('base64url');
    try {
      const user = await this.prisma.user.create({ data: { full_name, phone, email, password_hash: await hash(temporary_password, 12), patient: { create: profile } }, select: { ...userSummary, email: true, patient: true } });
      return { ...user, temporary_password: password ? undefined : temporary_password };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new DomainException(3006, 'User phone or email already exists', 409);
      throw error;
    }
  }

  async createRecord(actor: Actor, raw: unknown) {
    const input = schemaParse(dto.createRecordDto, raw);
    const patient_id = actor.role === 'patient' ? actor.id : input.patient_id;
    if (!patient_id) throw new DomainException(2003, 'patient_id is required when staff create a record');
    if (actor.role === 'patient' && input.patient_id && input.patient_id !== actor.id) throw new DomainException(3106, "Cannot access another user's data", 403);
    return this.prisma.$transaction(async client => {
      await client.$queryRaw(Prisma.sql`SELECT id FROM templates WHERE id = ${input.template_id}::uuid FOR UPDATE`);
      const patient = await client.patient.findFirst({ where: { user_id: patient_id, user: { is_active: true } } });
      if (!patient) throw new DomainException(3007, 'Patient not found', 404);
      const template = await client.template.findFirst({ where: { id: input.template_id, is_active: true, kind: 'clinical' } });
      if (!template) throw new DomainException(4101, 'Active template not found', 404);
      const record = await client.medicalRecord.create({ data: { patient_id, template_id: template.id, created_by: actor.id, status: 'pending' } });
      if (input.answers.length) await this.saveAnswers(client, actor, record, input.answers);
      return { ...record, medical_record_id: record.id };
    });
  }

  async allRecords(actor: Actor, raw: unknown) {
    const input = schemaParse(dto.paginationDto, raw);
    const where: Prisma.MedicalRecordWhereInput = actor.role === 'patient' ? { patient_id: actor.id, status: input.status } : actor.role === 'admin' ? { status: input.status } : { status: input.status, OR: [{ status: 'pending' }, { assigned_doctor_id: actor.id }] };
    const [items, total] = await Promise.all([this.prisma.medicalRecord.findMany({ where, select: { id: true, patient_id: true, template_id: true, assigned_doctor_id: true, status: true, created_at: true, completed_at: true, patient: { select: queuePatientSummary }, template: { select: { id: true, name: true } }, assigned_doctor: { select: userSummary } }, orderBy: { created_at: 'desc' }, skip: (input.page - 1) * input.limit, take: input.limit }), this.prisma.medicalRecord.count({ where })]);
    return { items, data: items, meta: { page: input.page, limit: input.limit, total, total_pages: Math.ceil(total / input.limit) } };
  }

  async record(actor: Actor, recordId: string) {
    await this.access.assertRecord(actor, recordId);
    const record = await this.prisma.medicalRecord.findUniqueOrThrow({ where: { id: recordId }, include: { patient: { include: { user: { select: userSummary } } }, assigned_doctor: { select: userSummary }, template: { include: templateTree }, answers: { include: answerTree }, prescriptions: { include: { items: true }, orderBy: { created_at: 'desc' } }, lab_requests: { include: { items: { include: { results: { include: { media: true } } } } } }, lesion_episodes: { include: episodeTree } } });
    return { ...record, medical_record_id: record.id, answers: record.answers.map(answerView) };
  }

  async summary(actor: Actor, recordId: string) {
    const record = await this.access.assertRecord(actor, recordId);
    const patient = await this.prisma.patient.findUniqueOrThrow({ where: { user_id: record.patient_id }, select: patientSummary });
    return { ...record, patient, patient_name: patient.user.full_name };
  }

  async history(actor: Actor, patientId: string) {
    await this.access.assertPatient(actor, patientId);
    return this.prisma.medicalRecord.findMany({ where: { patient_id: patientId, ...(actor.role !== 'patient' && actor.role !== 'admin' ? { assigned_doctor_id: actor.id } : {}) }, include: { patient: { select: patientSummary }, template: { select: { id: true, name: true } }, assigned_doctor: { select: userSummary } }, orderBy: { created_at: 'desc' } });
  }

  async accept(actor: Actor, recordId: string) {
    this.access.requireStaff(actor);
    parse(dto.id, recordId);
    const result = await this.prisma.$transaction(async client => {
      const updated = await client.medicalRecord.updateMany({ where: { id: recordId, status: 'pending', assigned_doctor_id: null }, data: { assigned_doctor_id: actor.id, status: 'in_progress' } });
      if (!updated.count) {
        const record = await client.medicalRecord.findUnique({ where: { id: recordId } });
        if (!record) throw new DomainException(4001, 'Medical record not found', 404);
        policy(actor, record, 'accept');
        throw new DomainException(4005, 'Already accepted by another doctor', 409);
      }
      const record = await client.medicalRecord.findUniqueOrThrow({ where: { id: recordId } });
      const notification = await this.persistNotification(client, record.patient_id, 'record_accepted', 'Hồ sơ đã được tiếp nhận', 'Bác sĩ đã tiếp nhận hồ sơ khám của bạn.', record.id);
      return { record, notification };
    });
    this.dispatchNotification(result.notification);
    return result.record;
  }

  async complete(actor: Actor, recordId: string, raw: unknown) {
    this.access.requireStaff(actor);
    const input = schemaParse(dto.closeRecordDto, raw);
    const result = await this.access.withRecordWrite(actor, recordId, async (client, record) => {
      policy(actor, record, 'complete');
      const missing = await this.missingRequiredAnswers(client, record);
      if (missing.length) throw new DomainException(4006, `Required answers missing: ${missing.join(', ')}`);
      const completed_at = new Date();
      const completed = await client.medicalRecord.update({ where: { id: recordId }, data: { instructions: input.instructions ?? input.notes, notes: input.notes, diagnosis: input.diagnosis, completed_at, closed_at: completed_at, status: 'completed' } });
      const notification = await this.persistNotification(client, record.patient_id, 'record_completed', 'Đã hoàn tất khám bệnh', 'Bác sĩ đã hoàn tất hồ sơ và chỉ dẫn điều trị.', record.id);
      return { record: completed, notification };
    });
    this.dispatchNotification(result.notification);
    return result.record;
  }

  async answers(actor: Actor, recordId: string) {
    await this.access.assertRecord(actor, recordId);
    return (await this.prisma.answer.findMany({ where: { medical_record_id: recordId }, include: answerTree })).map(answerView);
  }

  async updateAnswers(actor: Actor, recordId: string, raw: unknown) {
    const input = schemaParse(dto.updateAnswersDto, raw);
    return this.access.withRecordWrite(actor, recordId, async (client, record) => {
      policy(actor, record, 'edit');
      const answers = await this.saveAnswers(client, actor, record, input.answers);
      return { count: answers.length, answers: answers.map(answerView) };
    });
  }

  async deleteRecord(actor: Actor, recordId: string) {
    if (actor.role !== 'admin') throw new DomainException(3102, 'Admin role required', 403);
    parse(dto.id, recordId);
    await this.prisma.$transaction(async client => {
      await client.$queryRaw(Prisma.sql`SELECT id FROM medical_records WHERE id = ${recordId}::uuid FOR UPDATE`);
      await this.access.assertRecord(actor, recordId, { client });
      await client.prescription.deleteMany({ where: { medical_record_id: recordId } });
      await client.labRequest.deleteMany({ where: { medical_record_id: recordId } });
      await client.lesionEpisode.deleteMany({ where: { medical_record_id: recordId } });
      await client.medicalRecord.delete({ where: { id: recordId } });
    });
    return { deleted: true };
  }

  async uasEligibility(actor: Actor) {
    if (actor.role !== 'patient') throw new DomainException(3101, 'Patient role required', 403);
    const record = await this.prisma.medicalRecord.findFirst({ where: { patient_id: actor.id, status: { in: ['pending', 'in_progress'] } }, orderBy: { created_at: 'desc' }, select: { id: true } });
    return { eligible: record ? 'true' : 'false', medical_record_id: record?.id ?? null };
  }

  async createUas(actor: Actor, raw: unknown) {
    if (actor.role !== 'patient') throw new DomainException(3101, 'Patient role required', 403);
    const parsed = dto.uasDto.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = String(issue.path[0]);
      throw new DomainException(['iss7', 'hives_score'].includes(field) ? 5003 : ['hss7', 'itch_score'].includes(field) ? 5004 : 2003, issue.message);
    }
    const input = parsed.data;
    if (input.score_date > today()) throw new DomainException(2003, 'Score date cannot be in the future');
    const eligible = await this.prisma.medicalRecord.findFirst({ where: { patient_id: actor.id, status: { in: ['pending', 'in_progress'] }, ...(input.medical_record_id ? { id: input.medical_record_id } : {}) }, orderBy: { created_at: 'desc' } });
    if (!eligible) throw new DomainException(4002, 'Active medical record required', 409);
    try {
      return await this.access.withRecordWrite(actor, eligible.id, client => {
        const iss7 = input.iss7 ?? input.hives_score!;
        const hss7 = input.hss7 ?? input.itch_score!;
        return client.uas7Score.create({ data: { patient_id: actor.id, score_date: new Date(`${input.score_date}T00:00:00.000Z`), iss7, hss7, daily_score: iss7 + hss7, notes: input.notes } });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new DomainException(5002, 'Score for date already submitted', 409);
      throw error;
    }
  }

  async uasHistory(actor: Actor, patientId: string, endDate?: string) {
    await this.access.assertPatient(actor, patientId);
    const end_date = endDate ? parse(dto.isoDate, endDate) : today();
    const scores = await this.prisma.uas7Score.findMany({ where: { patient_id: patientId }, orderBy: { score_date: 'desc' } });
    const weekly_summary = new UasWeekHandler().execute({ end_date, scores: scores.map(score => ({ score_date: score.score_date.toISOString().slice(0, 10), iss7: score.iss7, hss7: score.hss7 })) });
    const uas7 = weekly_summary.uas7;
    const severity = uas7 === null ? 'Chưa đủ 7 ngày' : uas7 === 0 ? 'Không có triệu chứng' : uas7 <= 6 ? 'Kiểm soát tốt' : uas7 <= 15 ? 'Nhẹ' : uas7 <= 27 ? 'Trung bình' : 'Nặng';
    return { scores: scores.map(score => ({ ...score, score_date: score.score_date.toISOString().slice(0, 10), hives_score: score.iss7, itch_score: score.hss7 })), weekly_summary: { ...weekly_summary, severity } };
  }

  async createPrescription(actor: Actor, raw: unknown) {
    this.access.requireStaff(actor);
    const input = schemaParse(dto.prescriptionDto, raw, issue => issue.message === 'Medicine name is required' || issue.path.some(path => ['medicine_name', 'drug_name'].includes(String(path))) ? 8002 : 8001);
    const result = await this.access.withRecordWrite(actor, input.medical_record_id, async (client, record) => {
      policy(actor, record, 'edit');
      const prescription = await client.prescription.create({ data: { medical_record_id: record.id, doctor_id: actor.id, notes: input.notes ?? input.note ?? input.instructions, items: { create: (input.items ?? input.medicines!).map(item => ({ medicine_name: item.medicine_name ?? item.drug_name!, dosage: item.dosage, frequency: item.frequency, duration: item.duration, quantity: item.quantity, instructions: item.instructions ?? item.instruction })) } }, include: { items: true } });
      const notification = await this.persistNotification(client, record.patient_id, 'prescription', 'Bạn có đơn thuốc mới', 'Bác sĩ đã kê đơn thuốc cho hồ sơ khám của bạn.', record.id);
      return { prescription, notification };
    });
    this.dispatchNotification(result.notification);
    return { ...result.prescription, prescription_id: result.prescription.id, total_medicines: String(result.prescription.items.length) };
  }

  async prescriptions(actor: Actor, recordId: string) {
    await this.access.assertRecord(actor, recordId);
    return this.prisma.prescription.findMany({ where: { medical_record_id: recordId }, include: { items: true, doctor: { select: userSummary } }, orderBy: { created_at: 'desc' } });
  }

  async createLabRequest(actor: Actor, raw: unknown) {
    this.access.requireStaff(actor);
    const input = schemaParse(dto.labRequestDto, raw, issue => issue.path.includes('test_name') ? 8102 : 8101);
    return this.access.withRecordWrite(actor, input.medical_record_id, (client, record) => {
      policy(actor, record, 'edit');
      return client.labRequest.create({ data: { medical_record_id: record.id, doctor_id: actor.id, notes: input.notes ?? input.note ?? input.instructions, items: { create: (input.items ?? input.tests!).map(item => ({ test_name: item.test_name, notes: item.notes ?? item.description ?? item.instructions })) } }, include: { items: true } });
    });
  }

  async labRequests(actor: Actor, recordId: string) {
    await this.access.assertRecord(actor, recordId);
    return this.prisma.labRequest.findMany({ where: { medical_record_id: recordId }, include: { items: { include: { results: { include: { media: true } } } } }, orderBy: { created_at: 'desc' } });
  }

  async labResults(actor: Actor, recordId: string) {
    await this.access.assertRecord(actor, recordId);
    const [requests, results] = await Promise.all([this.labRequests(actor, recordId), this.prisma.labResult.findMany({ where: { item: { lab_request: { medical_record_id: recordId } } }, include: { item: { include: { lab_request: true } }, media: true }, orderBy: { created_at: 'desc' } })]);
    return { requests, results };
  }

  async createLabResult(actor: Actor, raw: unknown) {
    this.access.requireStaff(actor);
    const input = schemaParse(dto.labResultDto, raw);
    const item = await this.prisma.labRequestItem.findUnique({ where: { id: input.lab_request_item_id }, include: { lab_request: true } });
    if (!item) throw new DomainException(8103, 'Lab request item not found', 404);
    const result = await this.access.withRecordWrite(actor, item.lab_request.medical_record_id, async (client, record) => {
      policy(actor, record, 'edit');
      const media_id = input.media_id ?? input.attachment_id;
      if (media_id) await this.assertMedia(client, actor, record.patient_id, [media_id]);
      const result = await client.labResult.create({ data: { lab_request_item_id: input.lab_request_item_id, result_value: input.result_value, unit: input.unit, reference_range: input.reference_range, notes: input.notes, media_id }, include: { item: true, media: true } });
      const unreported = await client.labRequestItem.count({ where: { lab_request_id: item.lab_request_id, results: { none: {} } } });
      await client.labRequest.update({ where: { id: item.lab_request_id }, data: { status: unreported ? 'in_progress' : 'completed' } });
      const notification = await this.persistNotification(client, record.patient_id, 'lab_result', 'Có kết quả xét nghiệm', `Đã có kết quả ${item.test_name}.`, record.id);
      return { result, notification };
    });
    this.dispatchNotification(result.notification);
    return result.result;
  }

  private persistNotification(client: Prisma.TransactionClient, user_id: string, type: string, title: string, body: string, medical_record_id: string) {
    return client.notification.create({ data: { user_id, type, title, body, data: { medical_record_id }, delivery_status: 'pending' } });
  }

  private dispatchNotification(notification: { id: string; user_id: string; type: string; title: string; body: string; data: Prisma.JsonValue }) {
    this.events.emit('clinical.notification', { notification_id: notification.id, user_id: notification.user_id, type: notification.type, title: notification.title, body: notification.body, ...(notification.data as { medical_record_id: string }) });
  }

  private async assertMedia(client: Prisma.TransactionClient, actor: Actor, patientId: string, mediaIds: string[]) {
    const ids = [...new Set(mediaIds)];
    if (ids.some(mediaId => !dto.id.safeParse(mediaId).success)) throw new DomainException(2003, 'Invalid attachment ID');
    const count = await client.mediaAttachment.count({ where: { id: { in: ids }, uploaded_by: { in: [actor.id, patientId] } } });
    if (count !== ids.length) throw new DomainException(6005, 'Attachment not found or not owned by this patient', 403);
  }

  private answerValue(answer: dto.AnswerDto, question: ClinicalQuestion) {
    let value = answer.value !== undefined ? answer.value : answer.answer_value !== undefined ? answer.answer_value : answer.answer_text;
    const type = question.type_question.toLowerCase();
    const image = ['image', 'image_upload', 'image-upload'].includes(type);
    if ((value === null || value === undefined) && !answer.question_option_id && !question.is_required) return image ? [] : Prisma.JsonNull;
    if (answer.question_option_id) {
      const option = question.options.find(option => option.id === answer.question_option_id);
      if (!option || !['radio', 'checkbox', 'select'].includes(type)) throw new DomainException(4006, 'Option does not belong to this question');
      value = type === 'checkbox' ? [option.value] : option.value;
    }
    if (['text', 'textarea'].includes(type) && typeof value !== 'string') throw new DomainException(4006, 'Text answer is required');
    if (question.is_required && (typeof value === 'string' && !value.trim() || Array.isArray(value) && !value.length)) throw new DomainException(4006, 'Required answer cannot be empty');
    if (type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) throw new DomainException(4006, 'Numeric answer is required');
    if (type === 'date' && !dto.isoDate.safeParse(value).success) throw new DomainException(4006, 'ISO calendar date answer is required');
    if (['radio', 'select'].includes(type) && (typeof value !== 'string' || !question.options.some(option => option.value === value))) throw new DomainException(4006, 'Invalid question option');
    if (type === 'checkbox' && (!Array.isArray(value) || value.some(option => typeof option !== 'string' || !question.options.some(candidate => candidate.value === option)) || new Set(value).size !== value.length)) throw new DomainException(4006, 'Invalid checkbox options');
    if (['image', 'image_upload', 'image-upload'].includes(type) && (!Array.isArray(value) || value.some(mediaId => typeof mediaId !== 'string' || !dto.id.safeParse(mediaId).success))) throw new DomainException(4006, 'Image answers must contain attachment IDs');
    if (type === 'boolean' && typeof value !== 'boolean') throw new DomainException(4006, 'Boolean answer is required');
    if (value === undefined || value === null) throw new DomainException(4006, 'Answer value is required');
    return value as Prisma.InputJsonValue;
  }

  private async saveAnswers(client: Prisma.TransactionClient, actor: Actor, record: MedicalRecord, input: dto.AnswerDto[]) {
    const questions = await client.question.findMany({ where: { id: { in: input.map(answer => answer.question_id) }, section: { template_id: record.template_id } }, include: { options: true, section: true } });
    if (questions.length !== input.length) throw new DomainException(4006, 'Question does not belong to record template');
    for (const answer of input) {
      const question = questions.find(question => question.id === answer.question_id)!;
      if (actor.role !== 'admin' && question.section.filled_by !== 'both' && question.section.filled_by !== (actor.role === 'patient' ? 'patient' : 'doctor')) throw new DomainException(3101, 'Section cannot be filled by this user', 403);
      const value = this.answerValue(answer, question);
      const saved = await client.answer.upsert({ where: { medical_record_id_question_id: { medical_record_id: record.id, question_id: question.id } }, create: { medical_record_id: record.id, question_id: question.id, value, answer_text: answer.answer_text, question_option_id: answer.question_option_id }, update: { value, answer_text: answer.answer_text ?? null, question_option_id: answer.question_option_id ?? null } });
      if (['image', 'image_upload', 'image-upload'].includes(question.type_question.toLowerCase())) {
        const images = value as string[];
        await this.assertMedia(client, actor, record.patient_id, images);
        await client.answerImage.deleteMany({ where: { answer_id: saved.id } });
        if (images.length) await client.answerImage.createMany({ data: [...new Set(images)].map(media_id => ({ answer_id: saved.id, media_id })) });
      }
    }
    return client.answer.findMany({ where: { medical_record_id: record.id, question_id: { in: input.map(answer => answer.question_id) } }, include: answerTree });
  }

  private async missingRequiredAnswers(client: Prisma.TransactionClient, record: MedicalRecord) {
    const [questions, answers] = await Promise.all([client.question.findMany({ where: { section: { template_id: record.template_id } } }), client.answer.findMany({ where: { medical_record_id: record.id } })]);
    const values = new Map(answers.map(answer => [answer.question_id, answer.value]));
    const visible = (question: typeof questions[number], visiting = new Set<string>()): boolean => {
      if (!question.parent_question_id) return true;
      if (visiting.has(question.id)) return false;
      visiting.add(question.id);
      const parent = questions.find(parent => parent.id === question.parent_question_id);
      if (!parent || !visible(parent, visiting)) return false;
      const value = values.get(parent.id);
      const rule = ConditionalMatchInput.shape.condition_rules.safeParse(question.condition_rules);
      if (!rule.success) throw new DomainException(4006, 'Template question has invalid condition rules');
      return new ConditionalMatchHandler().execute({ parent_answer: value, show_if_answer: question.show_if_answer, condition_rules: rule.data });
    };
    return questions.filter(question => {
      const value = values.get(question.id);
      return question.is_required && visible(question) && (value === undefined || value === null || typeof value === 'string' && !value.trim() || Array.isArray(value) && !value.length);
    }).map(question => question.content);
  }
}
