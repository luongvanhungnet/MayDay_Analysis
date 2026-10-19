import { z } from 'zod';

export const id = z.string().uuid();
const text = z.string().trim().max(10000);
const name = z.string().trim().min(1).max(500);
const int = (min: number, max: number) => z.preprocess(value => typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value, z.number().int().min(min).max(max));
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date');
const timestamp = z.string().datetime({ offset: true });
const json = z.unknown().refine(value => value !== undefined, 'An answer value is required');

export const answerDto = z.object({ question_id: id, value: json.optional(), answer_value: json.optional(), answer_text: text.optional(), question_option_id: id.nullable().optional() }).strict().refine(value => value.value !== undefined || value.answer_value !== undefined || value.answer_text !== undefined || value.question_option_id != null, 'An answer value is required');
const answers = z.array(answerDto).max(300).refine(values => new Set(values.map(value => value.question_id)).size === values.length, 'Duplicate question IDs');
export const createRecordDto = z.object({ template_id: id, patient_id: id.optional(), answers: answers.default([]) }).strict();
export const updateAnswersDto = z.object({ answers }).strict();
export const closeRecordDto = z.object({ instructions: text.optional(), notes: text.optional(), diagnosis: text.optional() }).strict();
export const paginationDto = z.object({ page: int(1, 100000).default(1), limit: int(1, 100).default(25), status: z.enum(['pending', 'in_progress', 'completed']).optional() });
export const createPatientDto = z.object({ full_name: name, phone: z.string().regex(/^\+?[0-9]{9,15}$/), email: z.string().email().optional(), password: z.string().min(8).max(128).optional(), year_of_birth: int(1900, new Date().getUTCFullYear()).optional(), gender: z.enum(['male', 'female', 'other']).optional(), address: text.optional(), insurance_number: text.optional(), emergency_contact: text.optional(), emergency_phone: z.string().regex(/^\+?[0-9]{9,15}$/).optional() }).strict();
const screeningAnswer = z.object({ question_id: id, value: z.string().max(500).optional(), option_value: z.string().max(500).optional(), option_id: id.optional(), question_option_id: id.optional() }).strict().refine(value => value.value !== undefined || value.option_value !== undefined || value.option_id !== undefined || value.question_option_id !== undefined, 'Classification option is required');
export const classifyDto = z.union([z.object({ answers: z.array(screeningAnswer).min(1).max(300).refine(values => new Set(values.map(value => value.question_id)).size === values.length, 'Duplicate classification question IDs') }).strict(), z.object({ has_previous_visit: z.boolean(), has_chronic_urticaria: z.boolean() }).strict()]);
export const uasDto = z.object({ medical_record_id: id.optional(), score_date: isoDate, iss7: int(0, 3).optional(), hss7: int(0, 3).optional(), hives_score: int(0, 3).optional(), itch_score: int(0, 3).optional(), notes: text.optional() }).strict().refine(value => (value.iss7 ?? value.hives_score) !== undefined && (value.hss7 ?? value.itch_score) !== undefined, 'Both hives and itch scores are required');

const medicineDto = z.object({ medicine_name: name.optional(), drug_name: name.optional(), dosage: text.default(''), frequency: text.default(''), duration: text.default(''), quantity: int(1, 100000).default(1), instructions: text.optional(), instruction: text.optional() }).strict().refine(value => Boolean(value.medicine_name || value.drug_name), 'Medicine name is required');
export const prescriptionDto = z.object({ medical_record_id: id, notes: text.optional(), note: text.optional(), instructions: text.optional(), items: z.array(medicineDto).min(1).max(100).optional(), medicines: z.array(medicineDto).min(1).max(100).optional() }).strict().refine(value => Boolean(value.items?.length || value.medicines?.length), 'Medicines list cannot be empty');
const testDto = z.object({ test_name: name, notes: text.optional(), description: text.optional(), instructions: text.optional() }).strict();
export const labRequestDto = z.object({ medical_record_id: id, notes: text.optional(), note: text.optional(), instructions: text.optional(), items: z.array(testDto).min(1).max(100).optional(), tests: z.array(testDto).min(1).max(100).optional() }).strict().refine(value => Boolean(value.items?.length || value.tests?.length), 'Lab tests list cannot be empty');
export const labResultDto = z.object({ lab_request_item_id: id, result_value: name, unit: z.string().max(100).optional(), reference_range: z.string().max(300).optional(), notes: text.optional(), media_id: id.optional(), attachment_id: id.optional() }).strict();

export const episodeFields = z.object({ name, started_at: timestamp.optional(), ended_at: timestamp.nullable().optional(), context_tags: z.array(z.string().max(200)).max(50).optional(), medications: text.optional(), notes: text.optional() }).strict();
export const createEpisodeDto = episodeFields.extend({ medical_record_id: id });
export const updateEpisodeDto = episodeFields.partial().refine(value => Object.keys(value).length > 0, 'No changes supplied');
export const locationFields = z.object({ body_part: name, description: text.optional() }).strict();
export const createLocationDto = locationFields.extend({ episode_id: id });
export const updateLocationDto = locationFields.partial().refine(value => Object.keys(value).length > 0, 'No changes supplied');
export const milestone = z.enum(['start', 'peak', 'normal']);
export const createPhotoDto = z.object({ location_id: id, media_id: id.optional(), attachment_id: id.optional(), stage: milestone.optional(), milestone: milestone.optional(), itch_score: int(0, 10).default(0), pain_score: int(0, 10).default(0), burning_score: int(0, 10).optional(), burn_score: int(0, 10).optional(), hives_count: int(0, 1000000).default(0), captured_at: timestamp.optional() }).strict().refine(value => Boolean(value.media_id || value.attachment_id), 'Attachment ID is required').refine(value => Boolean(value.stage || value.milestone), 'Milestone is required');
export const updateMilestoneDto = z.object({ milestone: milestone.optional(), stage: milestone.optional() }).strict().refine(value => Boolean(value.milestone || value.stage), 'Milestone is required');

export type AnswerDto = z.infer<typeof answerDto>;
