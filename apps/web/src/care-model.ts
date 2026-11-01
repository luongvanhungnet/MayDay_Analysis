export type Row = Record<string, unknown>;
export const choiceLabels: Record<string, string> = {
  CAP: "Mề đay cấp",
  MAN: "Mề đay mạn",
  Nam: "Nam",
  Nu: "Nữ",
  start: "Bắt đầu",
  peak: "Đỉnh",
  normal: "Trở về bình thường",
  "Cong nhan": "Công nhân",
  "Nong dan": "Nông dân",
  "Hoc sinh - Sinh vien": "Học sinh – Sinh viên",
  "Can bo cong chuc": "Cán bộ công chức",
  Khac: "Khác",
};
export function initialPage(search: string) {
  const params = new URLSearchParams(search);
  if (params.get("view")) return `care:${params.get("view")}`;
  const table = params.get("table");
  if (!table) return "care:records";
  const mapped: Record<string, string> = {
    hosobenhan: "records",
    benhnhan: "patients",
    nguoi: "profile",
    dottonthuongda: "lesions",
    vitritonthuong: "lesions",
    anhchuptonthuong: "lesions",
    tepdinhkem: "media",
    nhatkyuashangngay: "uas",
    chinhanh: "branches",
    khoaphong: "departments",
    phongkham: "rooms",
    taikhoan: "users",
    vaitro: "roles",
    quyenhan: "permissions",
    vaitroquyenhan: "grants",
  };
  return mapped[table] ? `care:${mapped[table]}` : table;
}
export function recordActions(
  user: { role: string; person_id?: string },
  record: Row,
): string[] {
  if (!["admin", "bac_si"].includes(user.role)) return [];
  if (record.status === "pending") return ["accept"];
  const visit = record.latest_visit as Row | undefined;
  if (
    record.status === "in_progress" &&
    user.person_id &&
    String(visit?.assigned_doctor_id) === user.person_id
  )
    return ["prescribe", "complete"];
  return [];
}
export type InputField = {
  name: string;
  label: string;
  type?:
    | "text"
    | "password"
    | "date"
    | "datetime-local"
    | "number"
    | "textarea"
    | "boolean"
    | "select";
  required?: boolean;
  options?: readonly string[];
  reference?: string;
  min?: number;
  max?: number;
};
export type Resource = {
  title: string;
  path: string;
  columns: string[];
  fields: InputField[];
  admin?: boolean;
  readOnly?: boolean;
  patch?: boolean;
  noCreate?: boolean;
  noDelete?: boolean;
};
export function buildPayload(
  fields: InputField[],
  values: Record<string, string>,
  original?: Row,
): Row {
  const out: Row = {};
  for (const f of fields) {
    const v = values[f.name];
    if (original?.[f.name] && f.type === "datetime-local") {
      const old = new Date(String(original[f.name]));
      if (
        !Number.isNaN(old.getTime()) &&
        v ===
          new Date(old.getTime() - old.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16)
      )
        continue;
    }
    if (v === undefined || (original && String(original[f.name] ?? "") === v))
      continue;
    if (v === "") {
      if (original && !f.required) out[f.name] = null;
      continue;
    }
    if (f.type === "number") {
      const n = Number(v);
      if (
        !Number.isFinite(n) ||
        (f.min !== undefined && n < f.min) ||
        (f.max !== undefined && n > f.max)
      )
        throw Error(`${f.label}: giá trị không hợp lệ`);
      out[f.name] = n;
    } else if (f.type === "datetime-local") {
      const date = new Date(v);
      if (Number.isNaN(date.getTime()))
        throw Error(`${f.label}: thời gian không hợp lệ`);
      out[f.name] = date.toISOString();
    } else out[f.name] = f.type === "boolean" ? v === "true" : v;
  }
  return out;
}
const f = (
  name: string,
  label: string,
  extra: Partial<InputField> = {},
): InputField => ({ name, label, ...extra });
export const fields = { f };
export const resources: Record<string, Resource> = {
  branches: {
    title: "Chi nhánh",
    path: "/branches",
    admin: true,
    columns: ["name", "address", "phone", "is_active"],
    fields: [
      f("name", "Tên chi nhánh", { required: true }),
      f("address", "Địa chỉ", { required: true }),
      f("phone", "Số điện thoại"),
      f("is_active", "Đang hoạt động", { type: "boolean" }),
    ],
  },
  departments: {
    title: "Khoa phòng",
    path: "/departments",
    admin: true,
    columns: ["name", "branch_id", "type", "description"],
    fields: [
      f("name", "Tên khoa phòng", { required: true }),
      f("branch_id", "Chi nhánh", { reference: "branches", required: true }),
      f("type", "Loại khoa", { required: true }),
      f("description", "Mô tả", { type: "textarea" }),
    ],
  },
  rooms: {
    title: "Phòng khám",
    path: "/rooms",
    admin: true,
    columns: ["name", "department_id"],
    fields: [
      f("name", "Tên phòng khám", { required: true }),
      f("department_id", "Khoa phòng", {
        reference: "departments",
        required: true,
      }),
    ],
  },
  roles: {
    title: "Vai trò",
    path: "/roles",
    admin: true,
    noDelete: true,
    columns: ["name", "display_name", "description"],
    fields: [
      f("name", "Tên vai trò", { required: true }),
      f("display_name", "Tên hiển thị"),
      f("description", "Mô tả", { type: "textarea" }),
    ],
  },
  permissions: {
    title: "Quyền hạn",
    path: "/permissions",
    admin: true,
    columns: ["name", "group", "description"],
    fields: [
      f("name", "Tên quyền", { required: true }),
      f("group", "Nhóm quyền"),
      f("description", "Mô tả", { type: "textarea" }),
    ],
  },
};
export const names: Record<string, string> = {
  id: "Mã",
  name: "Tên",
  full_name: "Họ và tên",
  phone: "Số điện thoại",
  username: "Tên đăng nhập",
  role_id: "Vai trò",
  is_active: "Đang hoạt động",
  patient_id: "Bệnh nhân",
  record_type: "Loại bệnh án",
  status: "Trạng thái",
  initial_diagnosis: "Chẩn đoán ban đầu",
  created_at: "Ngày tạo",
  description: "Mô tả",
  address: "Địa chỉ",
  branch_id: "Chi nhánh",
  department_id: "Khoa phòng",
  type: "Loại",
  group: "Nhóm quyền",
  display_name: "Tên hiển thị",
  body_location: "Vị trí cơ thể",
  onset_at: "Thời điểm xuất hiện",
  file_name: "Tên ảnh",
  mime_type: "Định dạng",
  size: "Dung lượng (byte)",
  score_date: "Ngày chấm điểm",
  hss_score: "Điểm sẩn phù",
  iss_score: "Điểm ngứa",
  diem_uas_ngay: "Tổng UAS",
  milestone: "Mốc tiến triển",
  taken_at: "Thời điểm chụp",
  itch_score: "Điểm ngứa",
  pain_score: "Điểm đau",
  burning_score: "Điểm bỏng rát",
  wheal_count: "Số sẩn phù",
  medical_record_id: "Hồ sơ bệnh án",
  person_id: "Mã người",
};
Object.assign(names, {
  date_of_birth: "Ngày sinh",
  gender: "Giới tính",
  province: "Tỉnh / thành phố",
  ward: "Xã / phường",
  occupation: "Nghề nghiệp",
  ethnicity: "Dân tộc",
  insurance_number: "Số thẻ BHYT",
  insurance_expiry: "BHYT có giá trị đến",
  relative_name_address: "Họ tên / địa chỉ người nhà",
  relative_phone: "Số điện thoại người nhà",
  first_exam_at: "Khám lần đầu",
  treatment_start: "Bắt đầu điều trị",
  treatment_end: "Kết thúc điều trị",
  previous_diagnosis: "Chẩn đoán trước đây",
  onset_weeks: "Thời gian khởi phát (tuần)",
  ket_qua_dieu_tri_bao_hiem: "Kết quả điều trị",
  tien_su_gia_dinh: "Tiền sử gia đình",
  tien_su_gia_dinh_ghi_ro: "Chi tiết tiền sử gia đình",
  da_dieu_tri_truoc_kham: "Đã điều trị trước khám",
  assigned_doctor_id: "Bác sĩ phụ trách",
  date: "Ngày khám",
  instructions: "Dặn dò",
  role: "Vai trò",
  role_label: "Vai trò",
  updated_at: "Cập nhật lần cuối",
  patient: "Thông tin bệnh nhân",
  benhnhan: "Thông tin bệnh nhân",
});
export const menus = [
  { id: "records", title: "Hồ sơ bệnh án", group: "CHĂM SÓC" },
  {
    id: "patients",
    title: "Tiếp nhận bệnh nhân",
    group: "CHĂM SÓC",
    staff: true,
  },
  { id: "uas", title: "Nhật ký UAS", group: "THEO DÕI" },
  { id: "lesions", title: "Tổn thương da", group: "THEO DÕI" },
  { id: "media", title: "Kho ảnh của tôi", group: "THEO DÕI" },
  { id: "profile", title: "Hồ sơ cá nhân", group: "TÀI KHOẢN" },
  {
    id: "users",
    title: "Tài khoản & nhân viên",
    group: "QUẢN TRỊ",
    admin: true,
  },
  { id: "roles", title: "Vai trò", group: "QUẢN TRỊ", admin: true },
  { id: "permissions", title: "Quyền hạn", group: "QUẢN TRỊ", admin: true },
  {
    id: "grants",
    title: "Gán quyền cho vai trò",
    group: "QUẢN TRỊ",
    admin: true,
  },
  { id: "branches", title: "Chi nhánh", group: "CƠ SỞ" },
  { id: "departments", title: "Khoa phòng", group: "CƠ SỞ" },
  { id: "rooms", title: "Phòng khám", group: "CƠ SỞ" },
];
export const availableMenus = (role: string) =>
  menus.filter(
    (m) => (!m.admin || role === "admin") && (!m.staff || role !== "benh_nhan"),
  );
