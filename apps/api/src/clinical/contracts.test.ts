import { describe, expect, it } from 'vitest';
import { ClassificationHandler, ConditionalMatchHandler, RecordPolicyHandler, UasWeekHandler } from './contracts';

describe('clinical record policy', () => {
  it('locks answers after completion, including for the assigned doctor', () => {
    const result = new RecordPolicyHandler().execute({ actor: { id: 'doctor-a', role: 'doctor' }, record: { patient_id: 'patient-a', assigned_doctor_id: 'doctor-a', status: 'completed' }, action: 'edit' });
    expect(result).toEqual({ success: false, error: { code: 4003, message: 'Medical record already completed' } });
  });
  it('denies a doctor who is not assigned even when the case is in progress', () => {
    const result = new RecordPolicyHandler().execute({ actor: { id: 'doctor-b', role: 'doctor' }, record: { patient_id: 'patient-a', assigned_doctor_id: 'doctor-a', status: 'in_progress' }, action: 'complete' });
    expect(result).toEqual({ success: false, error: { code: 3105, message: 'Doctor not assigned to this record' } });
  });
  it('prevents a patient reading another patient record', () => {
    expect(new RecordPolicyHandler().execute({ actor: { id: 'patient-b', role: 'patient' }, record: { patient_id: 'patient-a', assigned_doctor_id: null, status: 'pending' }, action: 'read' })).toEqual({ success: false, error: { code: 3106, message: "Cannot access another user's data" } });
  });
  it('refuses accepting an already assigned case', () => {
    expect(new RecordPolicyHandler().execute({ actor: { id: 'doctor-b', role: 'doctor' }, record: { patient_id: 'patient-a', assigned_doctor_id: 'doctor-a', status: 'in_progress' }, action: 'accept' })).toEqual({ success: false, error: { code: 4005, message: 'Already accepted by another doctor' } });
  });
  it('allows a patient to edit answers only before a doctor starts the visit', () => {
    expect(new RecordPolicyHandler().execute({ actor: { id: 'patient-a', role: 'patient' }, record: { patient_id: 'patient-a', assigned_doctor_id: 'doctor-a', status: 'in_progress' }, action: 'edit' }).success).toBe(false);
  });
  it('reports a completed visit as not pending when a doctor tries accepting it', () => {
    expect(new RecordPolicyHandler().execute({ actor: { id: 'doctor-a', role: 'doctor' }, record: { patient_id: 'patient-a', assigned_doctor_id: 'doctor-a', status: 'completed' }, action: 'accept' })).toEqual({ success: false, error: { code: 4004, message: 'Medical record not in pending status' } });
  });
});

describe('configurable classification', () => {
  it('selects the highest priority matching template independently of display names', () => {
    const previous = '30000000-0000-4000-8000-000000000022';
    const chronic = '30000000-0000-4000-8000-000000000023';
    const followup = '30000000-0000-4000-8000-000000000024';
    const first = '30000000-0000-4000-8000-000000000001';
    expect(new ClassificationHandler().execute({ answers: { [previous]: 'yes', [chronic]: 'yes' }, templates: [{ id: first, rules: { priority: 10, conditions: [{ question_id: chronic, value: 'yes' }] } }, { id: followup, rules: { priority: 20, conditions: [{ question_id: previous, value: 'yes' }] } }] })).toEqual({ success: true, template_id: followup });
  });
});

describe('conditional clinical questions', () => {
  it('matches a scalar answer against a list of permitted branch values', () => {
    expect(new ConditionalMatchHandler().execute({ parent_answer: 'food', show_if_answer: ['food', 'exercise'] })).toBe(true);
  });
  it('honors a contains rule for checkbox answers', () => {
    expect(new ConditionalMatchHandler().execute({ parent_answer: ['food', 'heat'], condition_rules: { operator: 'contains', value: 'heat' } })).toBe(true);
  });
});

describe('UAS7 calendar week', () => {
  it('requires seven distinct consecutive days and sums only that week', () => {
    const scores = Array.from({ length: 7 }, (_, index) => ({ score_date: `2026-10-0${index + 2}`, iss7: 3, hss7: 2 }));
    scores.push({ score_date: '2026-10-01', iss7: 3, hss7: 3 });
    expect(new UasWeekHandler().execute({ end_date: '2026-10-08', scores })).toEqual({ start_date: '2026-10-02', end_date: '2026-10-08', days_recorded: 7, complete: true, iss7_total: 21, hss7_total: 14, uas7: 35 });
  });
});
