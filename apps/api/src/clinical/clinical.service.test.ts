import 'reflect-metadata';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ClinicalService } from './clinical.service';
import { RecordAccessService } from './record-access.service';
import { PrismaService } from '../common/prisma.service';

const doctor = { id: '10000000-0000-4000-8000-000000000002', role: 'doctor' };
const record = { id: '40000000-0000-4000-8000-000000000001', patient_id: '10000000-0000-4000-8000-000000000003', template_id: '30000000-0000-4000-8000-000000000001', status: 'in_progress', assigned_doctor_id: doctor.id };
const questionId = '30000000-0000-4000-8000-000000000004';

describe('clinical persistence', () => {
  it('lets an optional answer be cleared without storing an undefined JSON value', async () => {
    const question = { id: questionId, type_question: 'text', is_required: false, section: { filled_by: 'both' }, options: [] };
    const upsert = vi.fn().mockResolvedValue({ id: 'answer-id', value: null });
    const client = { question: { findMany: vi.fn().mockResolvedValue([question]) }, answer: { upsert, findMany: vi.fn().mockResolvedValue([{ id: 'answer-id', question_id: questionId, value: null }]) } };
    const access = { withRecordWrite: vi.fn(async (_actor, _id, operation) => operation(client, record)) } as unknown as RecordAccessService;
    const service = new ClinicalService(client as unknown as PrismaService, access, new EventEmitter2());
    const result = await service.updateAnswers(doctor, record.id, { answers: [{ question_id: questionId, answer_value: null }] });
    expect(result.count).toBe(1);
    expect(upsert.mock.calls[0][0].update.value).toBe(Prisma.JsonNull);
  });
  it('rejects a required text answer that contains only whitespace', async () => {
    const question = { id: questionId, type_question: 'text', is_required: true, section: { filled_by: 'both' }, options: [] };
    const client = { question: { findMany: vi.fn().mockResolvedValue([question]) }, answer: { upsert: vi.fn().mockResolvedValue({ id: 'answer-id', value: '   ' }), findMany: vi.fn().mockResolvedValue([]) } };
    const access = { withRecordWrite: vi.fn(async (_actor, _id, operation) => operation(client, record)) } as unknown as RecordAccessService;
    const service = new ClinicalService(client as unknown as PrismaService, access, new EventEmitter2());
    await expect(service.updateAnswers(doctor, record.id, { answers: [{ question_id: questionId, answer_value: '   ' }] })).rejects.toMatchObject({ code: 4006 });
    expect(client.answer.upsert).not.toHaveBeenCalled();
  });
  it('uses the specified missing medicine name error before opening a transaction', async () => {
    const access = { requireStaff: vi.fn(), withRecordWrite: vi.fn() } as unknown as RecordAccessService;
    const service = new ClinicalService({} as PrismaService, access, new EventEmitter2());
    await expect(service.createPrescription(doctor, { medical_record_id: record.id, items: [{}] })).rejects.toMatchObject({ code: 8002 });
    expect(access.withRecordWrite).not.toHaveBeenCalled();
  });
});

describe('database classification', () => {
  it('returns screening question IDs and options from the database', async () => {
    const screen = { id: questionId, content: 'Câu hỏi do quản trị viên cấu hình', type_question: 'radio', options: [{ id: 'option-id', label: 'Có', value: 'yes' }] };
    const db = { question: { findMany: vi.fn().mockResolvedValue([screen]) } } as unknown as PrismaService;
    const service = new ClinicalService(db, {} as RecordAccessService, new EventEmitter2());
    const result = await service.classifyQuestions();
    expect(result[0]).toMatchObject({ question_id: questionId, question_text: screen.content, options: [{ option_text: 'Có', option_value: 'yes' }] });
    expect(db.question.findMany).toHaveBeenCalled();
  });
  it('selects the configured follow-up template for complete recognized screening answers', async () => {
    const previous = '30000000-0000-4000-8000-000000000022';
    const chronic = '30000000-0000-4000-8000-000000000023';
    const followup = '30000000-0000-4000-8000-000000000040';
    const questions = [previous, chronic].map(id => ({ id, options: [{ id: '30000000-0000-4000-8000-000000000099', value: 'yes' }, { id: '30000000-0000-4000-8000-000000000098', value: 'no' }] }));
    const templates = [{ id: record.template_id, name: 'Tên tùy ý A', classification_rules: { priority: 10, conditions: [{ question_id: chronic, value: 'yes' }] } }, { id: followup, name: 'Tên tùy ý B', classification_rules: { priority: 20, conditions: [{ question_id: previous, value: 'yes' }] } }];
    const db = { question: { findMany: vi.fn().mockResolvedValue(questions) }, template: { findMany: vi.fn().mockResolvedValue(templates) } } as unknown as PrismaService;
    const service = new ClinicalService(db, {} as RecordAccessService, new EventEmitter2());
    await expect(service.classify({ answers: [{ question_id: previous, value: 'yes' }, { question_id: chronic, option_value: 'yes' }] })).resolves.toMatchObject({ template_id: followup });
  });
  it('resolves a submitted question option ID against its screening question', async () => {
    const optionId = '30000000-0000-4000-8000-000000000099';
    const db = { question: { findMany: vi.fn().mockResolvedValue([{ id: questionId, options: [{ id: optionId, value: 'yes' }] }]) }, template: { findMany: vi.fn().mockResolvedValue([{ id: record.template_id, classification_rules: { priority: 0, conditions: [{ question_id: questionId, value: 'yes' }] } }]) } } as unknown as PrismaService;
    const service = new ClinicalService(db, {} as RecordAccessService, new EventEmitter2());
    await expect(service.classify({ answers: [{ question_id: questionId, question_option_id: optionId }] })).resolves.toMatchObject({ template_id: record.template_id });
  });
});
