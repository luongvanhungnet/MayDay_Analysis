import { z } from 'zod';

export const RecordPolicyInput = z.object({
  actor: z.object({ id: z.string(), role: z.string() }),
  record: z.object({ patient_id: z.string(), assigned_doctor_id: z.string().nullable(), status: z.enum(['pending', 'in_progress', 'completed']) }),
  action: z.enum(['read', 'edit', 'accept', 'complete']),
});
export const PolicyError = z.object({ code: z.number(), message: z.string() });
export const PolicyOutput = z.discriminatedUnion('success', [
  z.object({ success: z.literal(true) }),
  z.object({ success: z.literal(false), error: PolicyError }),
]);
export type PolicyResult = z.infer<typeof PolicyOutput>;
export interface RecordPolicySpec { execute(input: z.infer<typeof RecordPolicyInput>): PolicyResult }

export class RecordPolicyHandler implements RecordPolicySpec {
  execute(input: z.infer<typeof RecordPolicyInput>): PolicyResult {
    if (input.actor.role === 'patient' && input.actor.id !== input.record.patient_id) {
      return { success: false, error: { code: 3106, message: "Cannot access another user's data" } };
    }
    if (input.action === 'accept' && input.record.status !== 'pending') {
      const alreadyAssigned = input.record.status === 'in_progress' && input.record.assigned_doctor_id && input.record.assigned_doctor_id !== input.actor.id;
      return { success: false, error: { code: alreadyAssigned ? 4005 : 4004, message: alreadyAssigned ? 'Already accepted by another doctor' : 'Medical record not in pending status' } };
    }
    if (input.action !== 'read' && input.record.status === 'completed') {
      return { success: false, error: { code: 4003, message: 'Medical record already completed' } };
    }
    if (input.actor.role === 'patient' && (input.action === 'accept' || input.action === 'complete' || input.action === 'edit' && input.record.status !== 'pending')) {
      return { success: false, error: { code: 3101, message: 'This action requires the assigned doctor' } };
    }
    if (input.actor.role !== 'admin' && input.actor.role !== 'patient' && input.action !== 'accept' && input.record.assigned_doctor_id !== input.actor.id) {
      return { success: false, error: { code: 3105, message: 'Doctor not assigned to this record' } };
    }
    if (input.action === 'complete' && input.record.status !== 'in_progress') {
      return { success: false, error: { code: 4004, message: 'Medical record must be in progress before completion' } };
    }
    return { success: true };
  }
}

export const UasWeekInput = z.object({ end_date: z.string(), scores: z.array(z.object({ score_date: z.string(), iss7: z.number().int().min(0).max(3), hss7: z.number().int().min(0).max(3) })) });
export const UasWeekOutput = z.object({ start_date: z.string(), end_date: z.string(), days_recorded: z.number(), complete: z.boolean(), iss7_total: z.number(), hss7_total: z.number(), uas7: z.number().nullable() });
export interface UasWeekSpec { execute(input: z.infer<typeof UasWeekInput>): z.infer<typeof UasWeekOutput> }
export class UasWeekHandler implements UasWeekSpec {
  execute(input: z.infer<typeof UasWeekInput>): z.infer<typeof UasWeekOutput> {
    const start = new Date(`${input.end_date}T00:00:00.000Z`);
    start.setUTCDate(start.getUTCDate() - 6);
    const start_date = start.toISOString().slice(0, 10);
    const days = new Map(input.scores.filter(score => score.score_date >= start_date && score.score_date <= input.end_date).map(score => [score.score_date, score]));
    const iss7_total = [...days.values()].reduce((sum, score) => sum + score.iss7, 0);
    const hss7_total = [...days.values()].reduce((sum, score) => sum + score.hss7, 0);
    const complete = days.size === 7;
    return { start_date, end_date: input.end_date, days_recorded: days.size, complete, iss7_total, hss7_total, uas7: complete ? iss7_total + hss7_total : null };
  }
}

export const ConditionalMatchInput = z.object({ parent_answer: z.unknown(), show_if_answer: z.unknown().optional(), condition_rules: z.object({ operator: z.enum(['equals', 'contains', 'not_equals']), value: z.union([z.string(), z.number(), z.boolean()]) }).nullable().optional() });
export interface ConditionalMatchSpec { execute(input: z.infer<typeof ConditionalMatchInput>): boolean }
export class ConditionalMatchHandler implements ConditionalMatchSpec {
  execute(input: z.infer<typeof ConditionalMatchInput>): boolean {
    const value = input.parent_answer;
    if (value === undefined || value === null) return false;
    if (input.condition_rules) {
      const rule = input.condition_rules;
      if (rule.operator === 'contains') return Array.isArray(value) ? value.some(answer => Object.is(answer, rule.value)) : typeof value === 'string' && typeof rule.value === 'string' && value.includes(rule.value);
      const equals = Object.is(value, rule.value);
      return rule.operator === 'not_equals' ? !equals : equals;
    }
    const candidates = Array.isArray(input.show_if_answer) ? input.show_if_answer : [input.show_if_answer];
    return candidates.some(expected => Array.isArray(value) ? value.some(answer => Object.is(answer, expected)) : Object.is(value, expected));
  }
}

export const ClassificationRule = z.object({ priority: z.number().int().min(0).max(100000), conditions: z.array(z.object({ question_id: z.string().uuid(), value: z.string().min(1).max(500) })).max(300) }).strict();
export const ClassificationInput = z.object({ answers: z.record(z.string()), templates: z.array(z.object({ id: z.string().uuid(), rules: ClassificationRule })) });
export type ClassificationResult = { success: true; template_id: string } | { success: false; error: { code: 4101; message: string } };
export interface ClassificationSpec { execute(input: z.infer<typeof ClassificationInput>): ClassificationResult }
export class ClassificationHandler implements ClassificationSpec {
  execute(input: z.infer<typeof ClassificationInput>): ClassificationResult {
    const matched = input.templates.filter(template => template.rules.conditions.every(condition => input.answers[condition.question_id] === condition.value)).sort((left, right) => right.rules.priority - left.rules.priority || left.id.localeCompare(right.id))[0];
    return matched ? { success: true, template_id: matched.id } : { success: false, error: { code: 4101, message: 'No active template matches classification answers' } };
  }
}
