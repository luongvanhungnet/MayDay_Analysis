import type { AnswerValue } from "./form-logic";

export interface User {
  id: string;
  full_name: string;
  phone: string;
  role: string | { name: string; code?: string };
  role_id?: string;
  year_of_birth?: number;
  gender?: string;
  patient?: Patient;
  staff?: {
    role?: { id?: string; name: string; code?: string };
    branch_id?: string;
    department_id?: string;
    room_id?: string;
  };
  is_active?: boolean;
}
export interface Patient {
  id: string;
  user_id?: string;
  full_name?: string;
  phone?: string;
  year_of_birth?: number;
  gender?: string;
  address?: string;
  user?: User;
  insurance_number?: string;
}
export interface Option {
  id?: string;
  label: string;
  value: string;
  order?: number;
}
export interface Question {
  id: string;
  content: string;
  type_question: string;
  is_required?: boolean;
  order?: number;
  options?: Option[];
  parent_question_id?: string | null;
  show_if_answer?: unknown;
  condition_rules?: { operator?: string; value?: unknown } | null;
}
export interface Section {
  id: string;
  title: string;
  description?: string;
  filled_by?: string;
  order?: number;
  questions: Question[];
}
export interface Template {
  _count?: { sections: number; medical_records: number };
  id: string;
  name: string;
  code_template: string;
  description?: string;
  is_active: boolean;
  sections?: Section[];
  version?: string;
  kind?: "clinical" | "classification";
  classification_rules?: {
    priority: number;
    conditions: { question_id: string; value: string }[];
  } | null;
}
export interface ClassificationQuestion {
  id: string;
  content: string;
  question_id?: string;
  question_text?: string;
  options: {
    id?: string;
    label: string;
    value: string;
    option_text?: string;
    option_value?: string;
  }[];
}
export interface Answer {
  id?: string;
  question_id: string;
  answer_value?: AnswerValue;
  value?: AnswerValue;
  answer_text?: string;
  question_option_id?: string | null;
  images?: Media[];
}
export interface MedicalRecord {
  id: string;
  patient_id: string;
  template_id: string;
  assigned_doctor_id?: string;
  status: "pending" | "in_progress" | "completed";
  created_at: string;
  completed_at?: string;
  instructions?: string;
  patient?: Patient;
  template?: Template;
  answers?: Answer[];
  assigned_doctor?: User;
}
export interface Prescription {
  id: string;
  created_at: string;
  note?: string;
  notes?: string;
  items: {
    id?: string;
    medicine_name: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    quantity?: number;
    instruction?: string;
    instructions?: string;
  }[];
}
export interface LabItem {
  id: string;
  test_name: string;
  description?: string;
  notes?: string;
  results?: LabResult[];
  lab_results?: LabResult[];
}
export interface LabResult {
  id: string;
  result_value: string;
  unit?: string;
  reference_range?: string;
  notes?: string;
  created_at?: string;
  lab_request_item?: LabItem;
}
export interface LabRequest {
  id: string;
  note?: string;
  status?: string;
  created_at?: string;
  items: LabItem[];
}
export interface Score {
  id: string;
  score_date: string;
  itch_score?: number;
  hives_score?: number;
  hss7?: number;
  iss7?: number;
  total_score?: number;
  daily_score?: number;
}
export interface Scores {
  scores: Score[];
  weekly_summary?: {
    uas7?: number;
    total?: number;
    days_recorded?: number;
    severity?: string;
  };
}
export interface Media {
  id: string;
  filename?: string;
  original_name?: string;
  mime_type?: string;
  created_at?: string;
  url?: string;
}
export interface LesionPhoto {
  id: string;
  attachment_id?: string;
  media_id?: string;
  milestone?: string;
  stage?: string;
  itch_score?: number;
  pain_score?: number;
  burn_score?: number;
  hives_count?: number;
  local_auas?: number;
  attachment?: Media;
}
export interface LesionLocation {
  id: string;
  body_part: string;
  photos?: LesionPhoto[];
}
export interface LesionEpisode {
  id: string;
  name?: string;
  started_at?: string;
  onset_at?: string;
  created_at?: string;
  notes?: string;
  context_tags?: string[];
  medications?: string;
  locations?: LesionLocation[];
  medical_record_id?: string;
}
export interface Notification {
  id: string;
  title: string;
  body?: string;
  content?: string;
  message?: string;
  created_at: string;
  is_read: boolean | string;
}
export interface Facility {
  id: string;
  name: string;
  address?: string;
  code?: string;
  branch_id?: string;
  department_id?: string;
  departments?: Facility[];
  rooms?: Facility[];
}
export interface Role {
  id: string;
  name: string;
  code?: string;
  description?: string;
  permissions?: Permission[];
}
export interface Permission {
  id: string;
  name: string;
  code: string;
  description?: string;
}
export function userRole(user: User): string {
  return (
    typeof user.role === "string"
      ? user.role
      : user.role?.code ||
        user.role?.name ||
        user.staff?.role?.code ||
        user.staff?.role?.name ||
        ""
  ).toLowerCase();
}
export function patientName(patient?: Patient): string {
  return patient?.user?.full_name || patient?.full_name || "Bệnh nhân";
}
export function patientPhone(patient?: Patient): string {
  return patient?.user?.phone || patient?.phone || "—";
}
export function rows<T>(
  value:
    | T[]
    | { items?: T[]; data?: T[]; records?: T[]; patients?: T[] }
    | null
    | undefined,
): T[] {
  return Array.isArray(value)
    ? value
    : value?.items || value?.data || value?.records || value?.patients || [];
}
