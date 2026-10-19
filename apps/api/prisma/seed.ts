import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '../../../.env'), quiet: true });
const prisma = new PrismaClient();
const ids = {
  admin: '10000000-0000-4000-8000-000000000001', doctor: '10000000-0000-4000-8000-000000000002', patient: '10000000-0000-4000-8000-000000000003',
  branch: '20000000-0000-4000-8000-000000000001', department: '20000000-0000-4000-8000-000000000002', room: '20000000-0000-4000-8000-000000000003',
  template: '30000000-0000-4000-8000-000000000001', section: '30000000-0000-4000-8000-000000000002', sectionDoctor: '30000000-0000-4000-8000-000000000003',
  qSymptom: '30000000-0000-4000-8000-000000000004', qTrigger: '30000000-0000-4000-8000-000000000005', qFood: '30000000-0000-4000-8000-000000000006', qDays: '30000000-0000-4000-8000-000000000007', qDoctor: '30000000-0000-4000-8000-000000000008',
  classificationTemplate: '30000000-0000-4000-8000-000000000020', classificationSection: '30000000-0000-4000-8000-000000000021',
  qPreviousVisit: '30000000-0000-4000-8000-000000000022', qChronic: '30000000-0000-4000-8000-000000000023',
  acuteTemplate: '30000000-0000-4000-8000-000000000030', acuteSection: '30000000-0000-4000-8000-000000000031', qAcuteSymptoms: '30000000-0000-4000-8000-000000000032',
  followupTemplate: '30000000-0000-4000-8000-000000000040', followupSection: '30000000-0000-4000-8000-000000000041', qFollowupProgress: '30000000-0000-4000-8000-000000000042',
  record: '40000000-0000-4000-8000-000000000001', pendingRecord: '40000000-0000-4000-8000-000000000002', completeRecord: '40000000-0000-4000-8000-000000000003',
  prescription: '50000000-0000-4000-8000-000000000001', prescriptionItem: '50000000-0000-4000-8000-000000000002',
  lab: '60000000-0000-4000-8000-000000000001', labItem: '60000000-0000-4000-8000-000000000002', labResult: '60000000-0000-4000-8000-000000000003',
  episode: '70000000-0000-4000-8000-000000000001', location: '70000000-0000-4000-8000-000000000002',
};

async function seed() {
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password || password.length < 8) throw new Error('Set SEED_DEMO_PASSWORD (at least 8 characters) before seeding demo accounts');
  const password_hash = await hash(password, 12);
  const roles = {} as Record<string, { id: string }>;
  for (const [code, name] of Object.entries({ admin: 'Quản trị viên', doctor: 'Bác sĩ', patient: 'Bệnh nhân' })) roles[code] = await prisma.role.upsert({ where: { code }, create: { code, name }, update: {} });
  const permissionNames: Record<string, string> = {
    'admin.manage': 'Quản trị tài khoản và cơ sở', 'templates.read': 'Xem mẫu phiếu khám', 'templates.write': 'Thiết kế mẫu phiếu khám',
    'view_records': 'Xem bệnh án được phân công', 'manage_records': 'Khám và cập nhật bệnh án',
    'media.read': 'Xem tệp được cấp quyền', 'media.write': 'Tải lên tệp y tế', 'notifications.read': 'Xem thông báo cá nhân', 'notifications.write': 'Quản lý thông báo và thiết bị',
  };
  const permissions: Record<string, { id: string }> = {};
  for (const [code, name] of Object.entries(permissionNames)) permissions[code] = await prisma.permission.upsert({ where: { code }, create: { code, name }, update: {} });
  const grants: Record<string, string[]> = {
    admin: Object.keys(permissions), doctor: Object.keys(permissions).filter((code) => code !== 'admin.manage'),
    patient: ['templates.read', 'media.read', 'media.write', 'notifications.read', 'notifications.write', 'view_records', 'manage_records'],
  };
  for (const [role, codes] of Object.entries(grants)) await prisma.rolePermission.createMany({ data: codes.map((code) => ({ role_id: roles[role].id, permission_id: permissions[code].id })), skipDuplicates: true });
  await prisma.branch.upsert({ where: { id: ids.branch }, create: { id: ids.branch, name: 'MayDay · Hà Nội', address: 'Hà Nội, Việt Nam', phone: '02438220000' }, update: {} });
  await prisma.department.upsert({ where: { id: ids.department }, create: { id: ids.department, branch_id: ids.branch, name: 'Khoa Da liễu', description: 'Theo dõi mề đay mạn tính' }, update: {} });
  await prisma.room.upsert({ where: { id: ids.room }, create: { id: ids.room, department_id: ids.department, name: 'Phòng khám 01' }, update: {} });
  for (const [key, full_name, phone, email] of [
    ['admin', 'Quản trị MayDay', '0900000001', 'admin@mayday.local'], ['doctor', 'BS. Nguyễn Minh Anh', '0900000002', 'doctor@mayday.local'], ['patient', 'Trần Hoàng Nam', '0900000003', 'patient@mayday.local'],
  ] as const) {
    await prisma.user.upsert({ where: { phone }, create: { id: ids[key], full_name, phone, email, password_hash, notification_setting: { create: {} }, ...(key === 'patient' ? { patient: { create: { year_of_birth: 1994, gender: 'male', occupation: 'Kỹ sư', ethnicity: 'Kinh', address: 'Cầu Giấy, Hà Nội', province: 'Hà Nội', district: 'Cầu Giấy' } } } : { staff: { create: { role_id: roles[key].id, branch_id: ids.branch, department_id: ids.department, room_id: ids.room, specialty: key === 'doctor' ? 'Da liễu' : undefined } } }) }, update: {} });
  }
  const chronicRules = { priority: 10, conditions: [{ question_id: ids.qChronic, value: 'yes' }] };
  await prisma.template.upsert({ where: { id: ids.template }, create: { id: ids.template, code_template: 'MD-URTICARIA-01', name: 'Khám mề đay mạn tính', description: 'Ghi nhận triệu chứng, yếu tố khởi phát và đánh giá lâm sàng', version: '1.0', kind: 'clinical', classification_rules: chronicRules }, update: { kind: 'clinical', classification_rules: chronicRules } });
  await prisma.template.upsert({ where: { id: ids.classificationTemplate }, create: { id: ids.classificationTemplate, code_template: 'MD-CLASSIFICATION', name: 'Sàng lọc phân loại bệnh án', description: 'Chọn mẫu phiếu dựa trên tiền sử khám và thời gian triệu chứng.', kind: 'classification', is_active: true }, update: { kind: 'classification' } });
  await prisma.templateSection.upsert({ where: { id: ids.classificationSection }, create: { id: ids.classificationSection, template_id: ids.classificationTemplate, title: 'Câu hỏi sàng lọc', filled_by: 'both', order: 0 }, update: {} });
  for (const screening of [
    { id: ids.qPreviousVisit, content: 'Bạn đã từng khám mề đay tại cơ sở này?', order: 0 },
    { id: ids.qChronic, content: 'Các triệu chứng đã kéo dài trên 6 tuần?', order: 1 },
  ]) {
    await prisma.question.upsert({ where: { id: screening.id }, create: { ...screening, section_id: ids.classificationSection, type_question: 'radio', is_required: true }, update: {} });
    for (const [value, label, order] of [['yes', 'Có', 0], ['no', 'Không', 1]] as const) await prisma.questionOption.upsert({ where: { question_id_value: { question_id: screening.id, value } }, create: { question_id: screening.id, value, label, order }, update: {} });
  }
  for (const setup of [
    { id: ids.acuteTemplate, code_template: 'MD-ACUTE', name: 'Khám mề đay cấp tính', description: 'Ghi nhận triệu chứng mới xuất hiện.', section: ids.acuteSection, question: ids.qAcuteSymptoms, question_content: 'Mô tả triệu chứng và thời điểm khởi phát', rules: { priority: 0, conditions: [{ question_id: ids.qChronic, value: 'no' }] } },
    { id: ids.followupTemplate, code_template: 'MD-FOLLOWUP', name: 'Tái khám mề đay', description: 'Theo dõi đáp ứng điều trị ở lần khám tiếp theo.', section: ids.followupSection, question: ids.qFollowupProgress, question_content: 'Triệu chứng thay đổi thế nào từ lần khám trước?', rules: { priority: 20, conditions: [{ question_id: ids.qPreviousVisit, value: 'yes' }] } },
  ]) {
    await prisma.template.upsert({ where: { id: setup.id }, create: { id: setup.id, code_template: setup.code_template, name: setup.name, description: setup.description, kind: 'clinical', classification_rules: setup.rules }, update: { kind: 'clinical', classification_rules: setup.rules } });
    await prisma.templateSection.upsert({ where: { id: setup.section }, create: { id: setup.section, template_id: setup.id, title: 'Triệu chứng hiện tại', filled_by: 'both', order: 0 }, update: {} });
    await prisma.question.upsert({ where: { id: setup.question }, create: { id: setup.question, section_id: setup.section, content: setup.question_content, type_question: 'text', is_required: true, order: 0 }, update: {} });
  }
  await prisma.templateSection.upsert({ where: { id: ids.section }, create: { id: ids.section, template_id: ids.template, title: 'Triệu chứng và tiền sử', order: 0, filled_by: 'patient' }, update: {} });
  await prisma.templateSection.upsert({ where: { id: ids.sectionDoctor }, create: { id: ids.sectionDoctor, template_id: ids.template, title: 'Đánh giá của bác sĩ', order: 1, filled_by: 'doctor' }, update: {} });
  for (const data of [
    { id: ids.qSymptom, section_id: ids.section, content: 'Mô tả triệu chứng hiện tại', type_question: 'text', is_required: true, order: 0 },
    { id: ids.qTrigger, section_id: ids.section, content: 'Triệu chứng xuất hiện sau ăn?', type_question: 'radio', is_required: true, order: 1 },
    { id: ids.qFood, section_id: ids.section, content: 'Thực phẩm đã sử dụng', type_question: 'text', parent_question_id: ids.qTrigger, show_if_answer: 'yes', order: 2 },
    { id: ids.qDays, section_id: ids.section, content: 'Số ngày xuất hiện triệu chứng', type_question: 'number', is_required: true, order: 3 },
    { id: ids.qDoctor, section_id: ids.sectionDoctor, content: 'Đánh giá và hướng điều trị', type_question: 'text', order: 0 },
  ]) await prisma.question.upsert({ where: { id: data.id }, create: data, update: {} });
  for (const [value, label, order] of [['yes', 'Có', 0], ['no', 'Không', 1]] as const) await prisma.questionOption.upsert({ where: { question_id_value: { question_id: ids.qTrigger, value } }, create: { question_id: ids.qTrigger, value, label, order }, update: {} });
  const day = new Date(); day.setUTCHours(0, 0, 0, 0);
  await prisma.medicalRecord.upsert({ where: { id: ids.record }, create: { id: ids.record, patient_id: ids.patient, template_id: ids.template, assigned_doctor_id: ids.doctor, created_by: ids.patient, status: 'in_progress', notes: 'Dữ liệu minh họa để kiểm thử giao diện và quy trình.', diagnosis: 'Theo dõi mề đay mạn tính (dữ liệu mẫu)', instructions: 'Ghi điểm hằng ngày, tái khám theo lịch bác sĩ.', created_at: new Date(day.getTime() - 6 * 86400000) }, update: {} });
  await prisma.medicalRecord.upsert({ where: { id: ids.pendingRecord }, create: { id: ids.pendingRecord, patient_id: ids.patient, template_id: ids.template, created_by: ids.patient, status: 'pending', notes: 'Bệnh án mẫu chờ tiếp nhận.' }, update: {} });
  await prisma.medicalRecord.upsert({ where: { id: ids.completeRecord }, create: { id: ids.completeRecord, patient_id: ids.patient, template_id: ids.template, assigned_doctor_id: ids.doctor, created_by: ids.doctor, status: 'completed', diagnosis: 'Bệnh án minh họa đã hoàn tất', completed_at: new Date(day.getTime() - 10 * 86400000), closed_at: new Date(day.getTime() - 10 * 86400000), created_at: new Date(day.getTime() - 15 * 86400000) }, update: {} });
  for (const [question_id, value] of [[ids.qSymptom, 'Nổi sẩn và ngứa từng đợt buổi tối'], [ids.qTrigger, 'yes'], [ids.qFood, 'Hải sản'], [ids.qDays, 14]] as const) await prisma.answer.upsert({ where: { medical_record_id_question_id: { medical_record_id: ids.record, question_id } }, create: { medical_record_id: ids.record, question_id, value, answer_text: String(value) }, update: {} });
  for (let offset = 0; offset < 7; offset++) {
    const score_date = new Date(day.getTime() - offset * 86400000); const iss7 = [1, 1, 2, 2, 2, 3, 3][offset]; const hss7 = [1, 1, 1, 2, 2, 2, 3][offset];
    await prisma.uas7Score.upsert({ where: { patient_id_score_date: { patient_id: ids.patient, score_date } }, create: { patient_id: ids.patient, score_date, iss7, hss7, daily_score: iss7 + hss7, notes: 'Điểm số minh họa' }, update: {} });
  }
  await prisma.prescription.upsert({ where: { id: ids.prescription }, create: { id: ids.prescription, medical_record_id: ids.record, doctor_id: ids.doctor, notes: 'Đơn thuốc minh họa, không dùng làm hướng dẫn điều trị thực tế.' }, update: {} });
  await prisma.prescriptionItem.upsert({ where: { id: ids.prescriptionItem }, create: { id: ids.prescriptionItem, prescription_id: ids.prescription, medicine_name: 'Thuốc minh họa', dosage: 'Theo chỉ định bác sĩ', frequency: 'Theo chỉ định', duration: '7 ngày (mẫu)', quantity: 7, instructions: 'Dữ liệu kiểm thử' }, update: {} });
  await prisma.labRequest.upsert({ where: { id: ids.lab }, create: { id: ids.lab, medical_record_id: ids.record, doctor_id: ids.doctor, status: 'completed', notes: 'Yêu cầu xét nghiệm minh họa' }, update: {} });
  await prisma.labRequestItem.upsert({ where: { id: ids.labItem }, create: { id: ids.labItem, lab_request_id: ids.lab, test_name: 'IgE toàn phần', notes: 'Dữ liệu thử nghiệm' }, update: {} });
  await prisma.labResult.upsert({ where: { id: ids.labResult }, create: { id: ids.labResult, lab_request_item_id: ids.labItem, result_value: '125', unit: 'IU/mL', reference_range: 'Khoảng tham chiếu từ phòng xét nghiệm', notes: 'Kết quả minh họa' }, update: {} });
  await prisma.lesionEpisode.upsert({ where: { id: ids.episode }, create: { id: ids.episode, name: 'Đợt bùng phát minh họa', patient_id: ids.patient, medical_record_id: ids.record, context_tags: ['sau ăn', 'buổi tối'], started_at: new Date(day.getTime() - 2 * 86400000), medications: 'Theo đơn bác sĩ', notes: 'Dữ liệu mẫu' }, update: {} });
  await prisma.lesionLocation.upsert({ where: { id: ids.location }, create: { id: ids.location, episode_id: ids.episode, body_part: 'arm', description: 'Cánh tay (minh họa)' }, update: {} });
  for (const [id, user_id, title, body, type, is_read] of [
    ['80000000-0000-4000-8000-000000000001', ids.patient, 'Đơn thuốc đã được cập nhật', 'Bạn có thể xem đơn thuốc trong hồ sơ bệnh án.', 'prescription', false],
    ['80000000-0000-4000-8000-000000000002', ids.patient, 'Nhắc ghi điểm UAS7', 'Ghi lại tình trạng triệu chứng hôm nay.', 'reminder', true],
    ['80000000-0000-4000-8000-000000000003', ids.doctor, 'Hồ sơ chờ tiếp nhận', 'Có hồ sơ bệnh án mới chờ bác sĩ tiếp nhận.', 'medical_record', false],
  ] as const) await prisma.notification.upsert({ where: { id }, create: { id, user_id, title, body, type, is_read, data: { medical_record_id: ids.record }, delivery_status: 'stored' }, update: {} });
  console.log('MayDay demo seeded. Accounts: 0900000001 (admin), 0900000002 (doctor), 0900000003 (patient). Password is SEED_DEMO_PASSWORD.');
}

seed().catch((error) => { console.error(error instanceof Error ? error.message : 'Seed failed'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
