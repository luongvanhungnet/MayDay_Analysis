import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { Actor } from '../auth/current-user.decorator';
import { DomainException } from '../common/domain.exception';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { parse, uuid } from '../common/validation';
import { hasParentCycle, isValidScreeningQuestion, questionInput } from './form-contract';

const rulesInput = z.object({ priority: z.number().int().min(0).max(100000), conditions: z.array(z.object({ question_id: uuid, value: z.string().min(1).max(500) })).max(300).refine(rows => new Set(rows.map(row => row.question_id)).size === rows.length, 'Duplicate classification conditions') }).strict();
const templateInput = z.object({ name: z.string().trim().min(1).max(200), code_template: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/).optional(), description: z.string().max(5000).nullable().optional(), version: z.string().max(30).default('1.0'), is_active: z.boolean().default(true), kind: z.enum(['clinical', 'classification']).default('clinical'), classification_rules: rulesInput.nullable().optional() }).strict();
const sectionInput = z.object({ title: z.string().trim().min(1).max(200), description: z.string().max(5000).nullable().optional(), order: z.number().int().min(0).default(0), filled_by: z.enum(['both', 'doctor', 'patient']).default('both') }).strict();
const structure = { sections: { orderBy: { order: 'asc' as const }, include: { questions: { orderBy: { order: 'asc' as const }, include: { options: { orderBy: { order: 'asc' as const } } } } } } };

@Injectable()
export class FormsService {
  constructor(private readonly db: PrismaService, private readonly redis: RedisService) {}
  async list(actor: Actor) {
    return this.db.template.findMany({ where: actor.role === 'patient' ? { is_active: true } : {}, orderBy: { created_at: 'desc' }, include: { _count: { select: { sections: true, medical_records: true } } }, take: 100 });
  }
  async detail(actor: Actor, id: string) {
    parse(uuid, id);
    const cached = await this.redis.get(`template:${id}`);
    const template = cached ? JSON.parse(cached) : await this.db.template.findUnique({ where: { id }, include: structure });
    if (!template) throw new DomainException(4101, 'Template not found', 404);
    if (actor.role === 'patient' && !template.is_active && !await this.db.medicalRecord.findFirst({ where: { patient_id: actor.id, template_id: id }, select: { id: true } })) throw new DomainException(4101, 'Template not found', 404);
    if (!cached) await this.redis.set(`template:${id}`, JSON.stringify(template), 60);
    return template;
  }
  private async validateRules(kind: string, rules: z.infer<typeof rulesInput> | null | undefined, db: Prisma.TransactionClient = this.db) {
    if (!rules) return;
    if (kind !== 'clinical') throw new DomainException(2003, 'Only clinical templates can have classification rules');
    const questions = await db.question.findMany({ where: { id: { in: rules.conditions.map(row => row.question_id) }, section: { template: { kind: 'classification', is_active: true } } }, include: { options: true } });
    if (rules.conditions.some(condition => !questions.some(question => question.id === condition.question_id && question.options.some(option => option.value === condition.value)))) throw new DomainException(2003, 'Classification conditions must reference an active screening question and its configured option');
  }
  async create(raw: unknown) {
    const data = parse(templateInput, raw); await this.validateRules(data.kind, data.classification_rules);
    return this.db.template.create({ data: { ...data, classification_rules: data.classification_rules === null ? Prisma.DbNull : data.classification_rules } });
  }
  async editable(id: string, db: Prisma.TransactionClient = this.db) {
    parse(uuid, id);
    const template = await db.template.findUnique({ where: { id }, include: { _count: { select: { medical_records: true } } } });
    if (!template) throw new DomainException(4101, 'Template not found', 404);
    if (template._count.medical_records) throw new DomainException(4104, 'Template is in use. Create a new version to preserve medical history.', 409);
    return template;
  }
  private async withTemplateWrite<T>(id: string, write: (tx: Prisma.TransactionClient) => Promise<T>, requireUnused = true) {
    parse(uuid, id);
    const result = await this.db.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM templates WHERE id = ${id}::uuid FOR UPDATE`);
      if (requireUnused) await this.editable(id, tx);
      else if (!await tx.template.findUnique({ where: { id }, select: { id: true } })) throw new DomainException(4101, 'Template not found', 404);
      return write(tx);
    });
    await this.redis.del(`template:${id}`); return result;
  }
  async update(id: string, raw: unknown) {
    const data = parse(templateInput.partial(), raw);
    return this.withTemplateWrite(id, async tx => {
      const current = await tx.template.findUniqueOrThrow({ where: { id } });
      if (data.kind && data.kind !== current.kind) await this.editable(id, tx);
      await this.validateRules(data.kind ?? current.kind, data.classification_rules === undefined ? current.classification_rules as z.infer<typeof rulesInput> | null : data.classification_rules, tx);
      return tx.template.update({ where: { id }, data: { ...data, classification_rules: data.classification_rules === null ? Prisma.DbNull : data.classification_rules } });
    }, false);
  }
  async remove(id: string) { return this.withTemplateWrite(id, async tx => { await tx.template.delete({ where: { id } }); return { id }; }); }
  async createSection(template_id: string, raw: unknown) {
    const data = parse(sectionInput, raw);
    return this.withTemplateWrite(template_id, tx => tx.templateSection.create({ data: { ...data, template_id } }));
  }
  private async section(id: string) {
    parse(uuid, id);
    const row = await this.db.templateSection.findUnique({ where: { id } });
    if (!row) throw new DomainException(4102, 'Section not found', 404);
    await this.editable(row.template_id); return row;
  }
  async updateSection(id: string, raw: unknown) {
    const row = await this.section(id);
    const data = parse(sectionInput.partial(), raw);
    return this.withTemplateWrite(row.template_id, tx => tx.templateSection.update({ where: { id }, data }));
  }
  async removeSection(id: string) { const row = await this.section(id); return this.withTemplateWrite(row.template_id, async tx => { await tx.templateSection.delete({ where: { id } }); return { id }; }); }
  private async question(id: string) {
    parse(uuid, id);
    const row = await this.db.question.findUnique({ where: { id }, include: { section: true, options: true } });
    if (!row) throw new DomainException(4103, 'Question not found', 404);
    await this.editable(row.section.template_id); return row;
  }
  private async validateParent(templateId: string, questionId: string, parentId: string | null | undefined, db: Prisma.TransactionClient = this.db) {
    if (!parentId) return;
    const questions = await db.question.findMany({ where: { section: { template_id: templateId } }, select: { id: true, parent_question_id: true } });
    if (!questions.some(q => q.id === parentId)) throw new DomainException(2003, 'Parent must belong to the same template');
    if (hasParentCycle(questionId, parentId, new Map(questions.map(q => [q.id, q.parent_question_id])))) throw new DomainException(2003, 'Question hierarchy cannot contain cycles');
  }
  private validateOptions(data: z.infer<typeof questionInput>) {
    if (['radio', 'checkbox'].includes(data.type_question) && !data.options.length) throw new DomainException(2003, 'Choice questions require options');
    if (new Set(data.options.map(o => o.value)).size !== data.options.length) throw new DomainException(2003, 'Option values must be unique');
  }
  async createQuestion(section_id: string, raw: unknown) {
    const section = await this.section(section_id); const data = parse(questionInput, raw); this.validateOptions(data);
    const { options, show_if_answer, condition_rules, ...fields } = data;
    return this.withTemplateWrite(section.template_id, async tx => {
      const template = await tx.template.findUniqueOrThrow({ where: { id: section.template_id } });
      if (!isValidScreeningQuestion(template.kind, data.type_question, data.parent_question_id)) throw new DomainException(2003, 'Screening questions must be unconditional radio questions');
      await this.validateParent(section.template_id, '', data.parent_question_id, tx);
      return tx.question.create({ data: { ...fields, section_id, show_if_answer: show_if_answer ?? Prisma.DbNull, condition_rules: condition_rules ?? Prisma.DbNull, options: { create: options } }, include: { options: true } });
    });
  }
  async updateQuestion(id: string, raw: unknown) {
    const row = await this.question(id);
    const partial = parse(questionInput.partial(), raw);
    return this.withTemplateWrite(row.section.template_id, async tx => {
      const current = await tx.question.findUniqueOrThrow({ where: { id }, include: { options: true } });
      const merged = parse(questionInput, { content: current.content, type_question: current.type_question, is_required: current.is_required, order: current.order, parent_question_id: current.parent_question_id, show_if_answer: current.show_if_answer, condition_rules: current.condition_rules, ...partial, options: partial.options ?? current.options.map(({ label, value, order }) => ({ label, value, order })) });
      this.validateOptions(merged);
      const template = await tx.template.findUniqueOrThrow({ where: { id: row.section.template_id } });
      if (!isValidScreeningQuestion(template.kind, merged.type_question, merged.parent_question_id)) throw new DomainException(2003, 'Screening questions must be unconditional radio questions');
      const { options, show_if_answer, condition_rules, ...fields } = merged;
      await this.validateParent(row.section.template_id, id, merged.parent_question_id, tx);
      return tx.question.update({ where: { id }, data: { ...fields, show_if_answer: show_if_answer ?? Prisma.DbNull, condition_rules: condition_rules ?? Prisma.DbNull, options: { deleteMany: {}, create: options } }, include: { options: true } });
    });
  }
  async removeQuestion(id: string) { const row = await this.question(id); return this.withTemplateWrite(row.section.template_id, async tx => { await tx.question.delete({ where: { id } }); return { id }; }); }
}
