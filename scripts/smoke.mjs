import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import assert from 'node:assert/strict';
config({ quiet: true });
if (process.env.NODE_ENV === 'production') throw new Error('Smoke testing is only for a development database');
const base = process.env.SMOKE_API_URL ?? 'http://localhost:3000/api/v1';
const password = process.env.SEED_DEMO_PASSWORD;
if (!password) throw new Error('Configure SEED_DEMO_PASSWORD for seeded development accounts');
const db = new PrismaClient();
let checks = 0;
const artifacts = { users: [], records: [], templates: [], media: [] };
async function request(path, token, method = 'GET', body, expected = 200) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) }, body: body ? body instanceof FormData ? body : JSON.stringify(body) : undefined });
  const result = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(result)}`);
  if (expected < 300) assert.ok(result.code === 1000 || result.code === 1001, JSON.stringify(result));
  checks++; return result.data;
}
async function signup(name) {
  const phone = `089${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
  const result = await request('/auth/signup', null, 'POST', { full_name: `Smoke ${name}`, phone, password, year_of_birth: 1995, gender: 'other' }, 201);
  artifacts.users.push(result.user.id); return result;
}
async function run() {
  await request('/health'); await request('/profile', null, 'GET', undefined, 401);
  const admin = await request('/auth/login', null, 'POST', { phone: '0900000001', password });
  const doctor = await request('/auth/login', null, 'POST', { phone: '0900000002', password });
  assert.ok(!JSON.stringify(admin.user).includes('password_hash')); checks++;
  await request('/admin/users', doctor.token, 'GET', undefined, 403);
  const patient = await signup('Patient'), stranger = await signup('Stranger');
  const screening = await request('/medical_records/classify-questions', patient.token);
  assert.equal(screening.length, 2); checks++;
  const screened = await request('/medical_records/classify', patient.token, 'POST', { answers: screening.map(question => ({ question_id: question.question_id, option_value: 'no' })) });
  assert.equal(screened.template_id, '30000000-0000-4000-8000-000000000030'); checks++;
  await request('/medical_records/classify', patient.token, 'POST', { answers: [{ question_id: screening[0].question_id, option_value: 'no' }] }, 400);
  await request('/medical_records', patient.token, 'POST', { template_id: '30000000-0000-4000-8000-000000000020' }, 404);
  await request('/templates', admin.token, 'POST', { name: 'Invalid routing rule', classification_rules: { priority: 1, conditions: [{ question_id: screening[0].question_id, value: 'unconfigured' }] } }, 400);
  await request('/admin/users', patient.token, 'GET', undefined, 403);
  await request('/medical_records/patients/' + patient.user.id + '/history', stranger.token, 'GET', undefined, 403);
  const template = await request('/templates', admin.token, 'POST', { name: 'Smoke workflow', description: 'Ephemeral integration fixture', kind: 'clinical', classification_rules: { priority: 1, conditions: [{ question_id: screening[0].question_id, value: 'yes' }] } }, 201); artifacts.templates.push(template.id);
  const section = await request(`/templates/${template.id}/sections`, admin.token, 'POST', { title: 'Symptoms', filled_by: 'both' }, 201);
  const parent = await request(`/templates/sections/${section.id}/questions`, admin.token, 'POST', { content: 'After eating?', type_question: 'radio', is_required: true, options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }] }, 201);
  const child = await request(`/templates/sections/${section.id}/questions`, admin.token, 'POST', { content: 'Describe foods', type_question: 'text', parent_question_id: parent.id, show_if_answer: 'yes', is_required: true }, 201);
  await request(`/templates/questions/${parent.id}`, admin.token, 'PUT', { parent_question_id: child.id }, 400);
  await request(`/templates/questions/${child.id}`, admin.token, 'PUT', { content: 'Food description', order: 1 });
  const record = await request('/medical_records', patient.token, 'POST', { template_id: template.id }, 201); artifacts.records.push(record.id);
  await request(`/medical_records/${record.id}`, stranger.token, 'GET', undefined, 403);
  await request(`/medical_records/${record.id}`, doctor.token, 'GET', undefined, 403);
  await request(`/templates/${template.id}/sections`, admin.token, 'POST', { title: 'Cannot rewrite existing structure' }, 409);
  await request(`/medical_records/${record.id}/answers`, patient.token, 'PUT', { answers: [{ question_id: parent.id, value: 'not-an-option' }] }, 400);
  const saved = await request(`/medical_records/${record.id}/answers`, patient.token, 'PUT', { answers: [{ question_id: parent.id, value: 'yes' }, { question_id: child.id, value: 'Example foods' }] });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64');
  const form = new FormData(); form.append('files', new Blob([png], { type: 'image/png' }), 'fixture.png');
  const uploads = await request('/image-attachments/upload', patient.token, 'POST', form, 201); artifacts.media.push(uploads[0].id);
  const fake = new FormData(); fake.append('files', new Blob(['<svg onload="alert(1)"></svg>'], { type: 'image/jpeg' }), 'fake.jpg');
  await request('/image-attachments/upload', patient.token, 'POST', fake, 400);
  const linked = await request('/answer-images', patient.token, 'POST', { answer_id: saved.answers[0].id, attachment_id: uploads[0].id }, 201);
  await request('/answer-images', patient.token, 'POST', { answer_id: saved.answers[0].id, attachment_id: uploads[0].id }, 409);
  const binary = await fetch(`${base}/image-attachments/${uploads[0].id}/content`, { headers: { Authorization: `Bearer ${patient.token}` } });
  assert.equal(binary.status, 200); assert.deepEqual(Buffer.from(await binary.arrayBuffer()), png); checks++;
  await request(`/image-attachments/${uploads[0].id}/content`, stranger.token, 'GET', undefined, 403);
  await request(`/image-attachments/${uploads[0].id}`, patient.token, 'DELETE', undefined, 409);
  const episode = await request('/lesion-episodes', patient.token, 'POST', { medical_record_id: record.id, name: 'Smoke flare', context_tags: ['after eating'] }, 201);
  const location = await request('/lesion-locations', patient.token, 'POST', { episode_id: episode.id, body_part: 'arm' }, 201);
  const photo = await request('/lesion-photos', patient.token, 'POST', { location_id: location.id, attachment_id: uploads[0].id, milestone: 'start', itch_score: 2, pain_score: 1 }, 201);
  await request('/lesion-photos', patient.token, 'POST', { location_id: location.id, attachment_id: uploads[0].id, milestone: 'peak', itch_score: 11 }, 400);
  await request(`/lesion-photos/${photo.id}/predict`, patient.token, 'POST', {}, 503);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  await request('/uas7-scores', patient.token, 'POST', { score_date: day, iss7: 1, hss7: 2 }, 201);
  await request('/uas7-scores', patient.token, 'POST', { score_date: day, iss7: 1, hss7: 2 }, 409);
  await request('/uas7-scores', patient.token, 'POST', { score_date: day, iss7: 4, hss7: 2 }, 400);
  const scores = await request(`/uas7-scores/patient/${patient.user.id}`, patient.token); assert.equal(scores.scores[0].daily_score, 3); checks++;
  const acceptResponses = await Promise.all([doctor, admin].map(account => fetch(`${base}/medical_records/${record.id}/accept`, { method: 'POST', headers: { Authorization: `Bearer ${account.token}` } })));
  assert.deepEqual(acceptResponses.map(r => r.status).sort(), [200, 409]); checks++;
  const clinician = acceptResponses[0].status === 200 ? doctor : admin;
  await request(`/medical_records/${record.id}`, clinician.token);
  await request('/prescriptions', clinician.token, 'POST', { medical_record_id: record.id, notes: 'Smoke fixture', items: [{ drug_name: 'Fixture medicine', dosage: 'fixture', frequency: 'fixture', duration: 'fixture' }] }, 201);
  const lab = await request('/lab-requests', clinician.token, 'POST', { medical_record_id: record.id, items: [{ test_name: 'Fixture test' }] }, 201);
  await request('/lab-results', clinician.token, 'POST', { lab_request_item_id: lab.items[0].id, result_value: 'fixture' }, 201);
  await request(`/lab-results/${record.id}`, patient.token);
  await request(`/medical_records/${record.id}`, clinician.token, 'PUT', { instructions: 'Fixture care instructions', diagnosis: 'Fixture only' });
  await request(`/medical_records/${record.id}/answers`, clinician.token, 'PUT', { answers: [{ question_id: child.id, value: 'cannot modify' }] }, 409);
  await request(`/lesion-photos/${photo.id}/milestone`, patient.token, 'PATCH', { milestone: 'peak' }, 409);
  await request(`/answer-images/${linked.id}`, patient.token, 'DELETE', undefined, 409);
  await request('/prescriptions', clinician.token, 'POST', { medical_record_id: record.id, items: [{ drug_name: 'blocked' }] }, 409);
  const notifications = await request('/notifications', patient.token);
  assert.ok(notifications.some(n => n.type === 'prescription')); checks++;
  await request(`/notifications/${notifications[0].id}/read`, stranger.token, 'PUT', {}, 404);
  await request('/auth/logout', stranger.token, 'POST', {});
  await request('/profile', stranger.token, 'GET', undefined, 401);
  console.log(`PASS: ${checks} live API checks (PostgreSQL, Redis, MinIO, ownership, RBAC, concurrent acceptance, UAS7, completed-state protection).`);
}
async function cleanup() {
  for (const recordId of artifacts.records) {
    await db.$transaction(async tx => {
      await tx.lesionEpisode.deleteMany({ where: { medical_record_id: recordId } });
      await tx.labRequest.deleteMany({ where: { medical_record_id: recordId } });
      await tx.prescription.deleteMany({ where: { medical_record_id: recordId } });
      await tx.medicalRecord.deleteMany({ where: { id: recordId } });
    });
  }
  // Test objects are private fixtures; remove their media through the authenticated API first.
  if (artifacts.media.length) {
    const admin = await request('/auth/login', null, 'POST', { phone: '0900000001', password });
    for (const id of artifacts.media) await request(`/image-attachments/${id}`, admin.token, 'DELETE');
  }
  await db.template.deleteMany({ where: { id: { in: artifacts.templates } } });
  await db.uas7Score.deleteMany({ where: { patient_id: { in: artifacts.users } } });
  await db.patient.deleteMany({ where: { user_id: { in: artifacts.users } } });
  await db.user.deleteMany({ where: { id: { in: artifacts.users } } });
}
try { await run(); } catch (error) { console.error(error.message); process.exitCode = 1; }
finally { try { await cleanup(); } catch (error) { console.error('Fixture cleanup failed:', error.message); process.exitCode = 1; } await db.$disconnect(); }
