import type { ApiBodyOptions } from "@nestjs/swagger";
import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";
import type { Endpoint } from "./catalog";
import { resources } from "./resources";
import {
  automaticSubtypes,
  choices,
  table,
  tables,
  writable,
  type Column,
  type Table,
} from "../native/schema";

const text = (
  description: string,
  extra: Partial<SchemaObject> = {},
): SchemaObject => ({ type: "string", description, ...extra });
const object = (
  properties: Record<string, SchemaObject>,
  required: string[] = [],
): SchemaObject => ({
  type: "object",
  additionalProperties: false,
  properties,
  ...(required.length ? { required } : {}),
});
const idSchema = (): SchemaObject =>
  text(
    "Mã bigint dạng chuỗi để giữ nguyên độ chính xác. Lấy ID thật từ API danh sách tương ứng.",
    { pattern: "^[1-9][0-9]*$", example: "1" },
  );
const newPassword = (): SchemaObject =>
  text("Mật khẩu mới: ít nhất 10 ký tự và tối đa 72 byte UTF-8.", {
    format: "password",
    minLength: 10,
    maxLength: 72,
    example: "MatKhauViDu2026!",
  });
const immutable = new Set([
  "ma_benh_nhan",
  "ma_nguoi",
  "ma_ho_so",
  "ma_phien_kham",
  "loai_benh_an",
  "loai_ket_qua_can_lam_sang",
]);

function columnDocumentation(t: Table, c: Column): SchemaObject {
  let s: SchemaObject;
  if (c.type === "bigint") s = idSchema();
  else if (c.type === "boolean") s = { type: "boolean", example: true };
  else if (/^(smallint|integer)/.test(c.type))
    s = { type: "integer", example: 0 };
  else if (/^(numeric|real|double)/.test(c.type))
    s = { type: "number", example: 0 };
  else if (c.type === "date")
    s = { type: "string", format: "date", example: "2026-11-01" };
  else if (c.type.startsWith("timestamp"))
    s = {
      type: "string",
      format: "date-time",
      example: "2026-11-01T09:00:00+07:00",
    };
  else
    s = {
      type: "string",
      maxLength: Number(
        c.type.match(/character varying\((\d+)\)/)?.[1] ?? 100000,
      ),
    };
  if (c.nullable) s.nullable = true;
  const values = choices(t, c);
  if (values.length) {
    s.enum = values;
    s.example = values[0];
  }
  const pattern = t.checks
    .find(
      (check) =>
        check.definition.includes(c.name) && check.definition.includes(" ~ "),
    )
    ?.definition.match(/~ '([^']+)'/)?.[1];
  if (pattern) s.pattern = pattern;
  if (c.name === "so_dien_thoai" || c.name === "nguoi_nha_so_dien_thoai")
    s.example = "0900000000";
  if (s.type === "integer" || s.type === "number") {
    for (const check of t.checks) {
      const lower = check.definition.match(
        new RegExp(`\\b${c.name}\\s*>=\\s*\\(?(-?\\d+(?:\\.\\d+)?)`),
      );
      const upper = check.definition.match(
        new RegExp(`\\b${c.name}\\s*<=\\s*\\(?(-?\\d+(?:\\.\\d+)?)`),
      );
      if (lower) s.minimum = Number(lower[1]);
      if (upper) s.maximum = Number(upper[1]);
    }
    s.example = s.minimum ?? 0;
  }
  s.description = `Cột ${t.name}.${c.name}.${c.default ? " Có giá trị mặc định khi bỏ qua." : ""}`;
  return s;
}

function nativeSchema(t: Table, update = false): SchemaObject {
  const properties: Record<string, SchemaObject> = {},
    required: string[] = [];
  for (const c of t.columns) {
    if (
      !writable(c) ||
      (update && (c.pk || immutable.has(c.name))) ||
      c.name === "mat_khau_ma_hoa"
    )
      continue;
    properties[c.name] = columnDocumentation(t, c);
    if (!update && !c.nullable && !c.default) required.push(c.name);
  }
  if (t.name === "taikhoan") {
    properties.password = newPassword();
    if (!update) required.push("password");
  }
  return { ...object(properties, required), title: t.name };
}
export function nativeRequestDocumentation(update = false): ApiBodyOptions {
  const supported = tables.filter(
    (t) => update || !automaticSubtypes.has(t.name),
  );
  return {
    required: true,
    description: `Body dùng tên cột native. Chọn schema có title trùng tham số :table. ${update ? "PATCH chỉ gửi trường cần sửa." : "Subtype tự tạo cùng bản ghi cha, không POST trực tiếp."} Không gửi cột identity, GENERATED hoặc hash mật khẩu. Các ràng buộc CHECK/FK vẫn được database kiểm tra. Ví dụ chỉ minh họa; thay ID theo database thật.`,
    schema: { anyOf: supported.map((t) => nativeSchema(t, update)) },
    examples: update
      ? {
          branch: {
            summary: "table = chinhanh",
            value: { ten_chi_nhanh: "Chi nhánh A" },
          },
        }
      : {
          person: {
            summary: "table = nguoi",
            value: { ho_ten: "Nguyễn Văn A", so_dien_thoai: "0900000000" },
          },
          record: {
            summary: "table = hosobenhan",
            value: { ma_benh_nhan: "1", loai_benh_an: "MAN" },
          },
          account: {
            summary: "table = taikhoan (người đã tồn tại)",
            value: {
              ma_nguoi: "1",
              ma_vai_tro: "1",
              ten_dang_nhap: "ten_dang_nhap",
              password: "MatKhauViDu2026!",
            },
          },
        },
  };
}
export function nativePatientDocumentation(): ApiBodyOptions {
  const patient = nativeSchema(table("benhnhan"));
  delete patient.properties!.ma_benh_nhan;
  patient.required = [];
  return described(
    object({ person: nativeSchema(table("nguoi")), patient }, ["person"]),
    {
      person: { ho_ten: "Nguyễn Văn A", so_dien_thoai: "0900000000" },
      patient: { nghe_nghiep: "Khac" },
    },
    "Route tương thích dùng tên cột native trong person và patient. ma_benh_nhan được liên kết tự động, không gửi từ client.",
  );
}

/** Canonical aliases come from the same mapping used by the runtime handler. */
export function resourceDocumentation(
  name: string,
  update = false,
): SchemaObject {
  const resource = resources[name],
    t = table(resource.table);
  const aliases = Object.fromEntries(
    Object.entries(resource.fields).map(([alias, column]) => [column, alias]),
  );
  const properties: Record<string, SchemaObject> = {},
    required: string[] = [];
  for (const c of t.columns) {
    if (
      !writable(c) ||
      (update && (c.pk || immutable.has(c.name))) ||
      c.name === "mat_khau_ma_hoa"
    )
      continue;
    const field = aliases[c.name] ?? c.name;
    properties[field] = columnDocumentation(t, c);
    if (!update && !c.nullable && !c.default && !c.identity && !c.generated)
      required.push(field);
  }
  // The runtime supplies these values itself or derives them from the actor.
  const optional =
    name === "roles"
      ? ["display_name"]
      : ["episodes", "records", "scores"].includes(name)
        ? ["patient_id"]
        : [];
  return {
    ...object(
      properties,
      required.filter((k) => !optional.includes(k)),
    ),
    description: `Tên trường API chuẩn cho ${t.name}. Handler cũng nhận tên cột native tương ứng; không gửi đồng thời alias và tên cột của cùng trường. ID ví dụ cần được thay bằng ID trong database của bạn.`,
  };
}
function valueFor(schema: SchemaObject): unknown {
  if (schema.example !== undefined) return schema.example;
  if (schema.enum?.length) return schema.enum[0];
  if (schema.type === "object")
    return Object.fromEntries(
      (schema.required ?? []).map((k) => [
        k,
        valueFor(schema.properties![k] as SchemaObject),
      ]),
    );
  if (schema.type === "array") return [valueFor(schema.items as SchemaObject)];
  if (schema.type === "boolean") return true;
  if (schema.type === "number" || schema.type === "integer")
    return schema.minimum ?? 0;
  return "Thông tin ví dụ";
}
function described(
  schema: SchemaObject,
  example: Record<string, unknown>,
  description?: string,
): ApiBodyOptions {
  return {
    required: true,
    schema,
    description:
      description ??
      "Các ID trong ví dụ là minh họa. Hãy thay bằng ID thật từ API danh sách; Execute gửi yêu cầu tới backend đang chạy.",
    examples: { sample: { summary: "Ví dụ request", value: example } },
  };
}
function registration(admin = false): SchemaObject {
  return object(
    {
      full_name: text("Họ tên; được loại bỏ khoảng trắng ở hai đầu.", {
        minLength: 1,
        maxLength: 150,
      }),
      phone: text("Số điện thoại gồm đúng 10 chữ số.", {
        pattern: "^\\d{10}$",
        minLength: 10,
        maxLength: 10,
      }),
      password: newPassword(),
      username: text("Tên đăng nhập, mặc định bằng phone.", {
        minLength: 1,
        maxLength: 100,
      }),
      gender: { type: "string", enum: ["male", "female", "Nam", "Nu"] },
      date_of_birth: { type: "string", format: "date" },
      province: text("Tỉnh / thành phố", { maxLength: 100 }),
      ward: text("Xã / phường", { maxLength: 100 }),
      address: text("Số nhà / thôn / phố", { maxLength: 255 }),
      ...(admin
        ? {
            role_id: {
              ...idSchema(),
              description:
                "ID vai trò. Mặc định bac_si khi tạo nhân viên, benh_nhan khi tạo user.",
            },
            branch_id: {
              ...idSchema(),
              description:
                "Bắt buộc nếu vai trò được chọn là nhân viên (khác benh_nhan).",
            },
            is_active: { type: "boolean", default: true },
          }
        : {}),
    },
    ["full_name", "phone", "password"],
  );
}
export function requestDocumentation(
  endpoint: Endpoint,
): ApiBodyOptions | undefined {
  if (
    endpoint.action === "unsupported" ||
    !["POST", "PUT", "PATCH"].includes(endpoint.method) ||
    ["logout", "accept"].includes(endpoint.action)
  )
    return undefined;
  if (endpoint.action === "login")
    return {
      required: true,
      description:
        "Dùng tên đăng nhập hoặc số điện thoại của tài khoản hiện có. Các giá trị ví dụ cần được thay bằng tài khoản của bạn.",
      schema: {
        ...object(
          {
            identifier: text("Tên đăng nhập hoặc số điện thoại", {
              minLength: 1,
              maxLength: 200,
            }),
            phone: text("Số điện thoại gắn với tài khoản", {
              minLength: 1,
              maxLength: 200,
            }),
            username: text("Tên đăng nhập", { minLength: 1, maxLength: 200 }),
            password: text("Mật khẩu hiện có; tối đa 72 byte UTF-8", {
              format: "password",
              minLength: 1,
              maxLength: 72,
            }),
          },
          ["password"],
        ),
        anyOf: [
          { required: ["identifier"] },
          { required: ["phone"] },
          { required: ["username"] },
        ],
      },
      examples: {
        username: {
          summary: "Đăng nhập bằng tên đăng nhập",
          value: { identifier: "ten_dang_nhap", password: "NhapMatKhauCuaBan" },
        },
        phone: {
          summary: "Đăng nhập bằng số điện thoại",
          value: { phone: "0900000000", password: "NhapMatKhauCuaBan" },
        },
      },
    };
  const action = endpoint.action;
  if (["signup", "staff", "userCreate"].includes(action))
    return described(
      registration(action !== "signup"),
      {
        full_name: "Nguyễn Văn A",
        phone: "0900000000",
        password: "MatKhauViDu2026!",
        ...(action === "staff" ? { branch_id: "1" } : {}),
      },
      action === "signup"
        ? "Đăng ký chỉ tạo vai trò bệnh nhân, không nhận role_id/is_active."
        : "Tạo đồng thời người, hồ sơ bệnh nhân/nhân viên và tài khoản trong transaction. Nhân viên cần branch_id thật.",
    );
  if (action === "password")
    return described(
      object(
        {
          old_password: text("Mật khẩu hiện tại", {
            format: "password",
            minLength: 1,
          }),
          new_password: newPassword(),
        },
        ["old_password", "new_password"],
      ),
      { old_password: "NhapMatKhauHienTai", new_password: "MatKhauMoi2026!" },
      "Sau khi đổi mật khẩu, phiên cũ mất hiệu lực; cần đăng nhập lại.",
    );
  if (action === "userUpdate") {
    const r = registration(true).properties!;
    return described(
      object(
        Object.fromEntries(
          [
            "full_name",
            "phone",
            "gender",
            "role_id",
            "is_active",
            "password",
            "username",
          ].map((k) => [k, r[k] as SchemaObject]),
        ),
      ),
      { full_name: "Nguyễn Văn A", is_active: true },
      "Chỉ gửi trường cần thay đổi. Không tự khóa hoặc đổi vai trò quản trị hiện tại; đổi vai trò cần hồ sơ bệnh nhân/nhân viên phù hợp.",
    );
  }
  if (action === "assign")
    return described(
      object({ branch_id: idSchema() }, ["branch_id"]),
      { branch_id: "1" },
      "Chỉ phân công chi nhánh cho tài khoản đã có hồ sơ nhân viên. Không nhận department_id hoặc room_id.",
    );
  if (action === "grant")
    return described(
      object(
        {
          role_id: idSchema(),
          permission_ids: {
            type: "array",
            items: idSchema(),
            minItems: 1,
            maxItems: 200,
          },
        },
        ["role_id", "permission_ids"],
      ),
      { role_id: "1", permission_ids: ["1", "2"] },
    );
  if (action === "complete")
    return described(
      object(
        {
          instructions: text("Dặn dò được lưu vào phiên khám mới nhất.", {
            maxLength: 100000,
          }),
        },
        ["instructions"],
      ),
      { instructions: "Nội dung dặn dò của bác sĩ" },
      "Chỉ bác sĩ phụ trách được chốt bệnh án in_progress. Sau khi chốt trạng thái là completed.",
    );
  if (action === "profileUpdate") {
    const people = resourceDocumentation("people", true).properties!;
    const patient = resourceDocumentation("patients", true).properties!;
    const extra = Object.fromEntries(
      [
        "occupation",
        "ethnicity",
        "insurance_number",
        "insurance_expiry",
        "relative_name_address",
        "relative_phone",
      ].map((k) => [k, patient[k] as SchemaObject]),
    );
    return described(
      object({ ...people, ...extra } as Record<string, SchemaObject>),
      { full_name: "Nguyễn Văn A", phone: "0900000000" },
      "Chỉ thay đổi hồ sơ của người đang đăng nhập. Các trường nghề nghiệp, BHYT/người nhà yêu cầu hồ sơ bệnh nhân. Không nhận role_id, user_id hoặc person_id.",
    );
  }
  if (action === "patientCreate") {
    const patient = resourceDocumentation("patients");
    delete patient.properties!.ma_benh_nhan;
    patient.required = [];
    return described(
      object({ person: resourceDocumentation("people"), patient }, ["person"]),
      {
        person: { full_name: "Nguyễn Văn A", phone: "0900000000" },
        patient: { occupation: "Khac" },
      },
      "Dạng body khuyến nghị: person + patient. Tạo nguoi và benhnhan, không tạo tài khoản đăng nhập.",
    );
  }
  if (action === "recordCreate") {
    const schema = resourceDocumentation("records");
    schema.properties!.status = {
      type: "string",
      enum: ["pending"],
      default: "pending",
    };
    return described(
      schema,
      { patient_id: "1", record_type: "MAN" },
      "Bệnh nhân có thể bỏ patient_id, server dùng người đang đăng nhập. Nhân viên phải gửi patient_id. CAP/MAN tự tạo subtype tương ứng.",
    );
  }
  if (action === "score") {
    const source = resourceDocumentation("scores").properties!;
    const properties = Object.fromEntries(
      [
        "patient_id",
        "medical_record_id",
        "cycle_id",
        "score_date",
        "day_in_cycle",
        "hss_score",
        "iss_score",
        "medication_status",
      ].map((k) => [k, source[k] as SchemaObject]),
    );
    properties.hss_score = { type: "integer", minimum: 0, maximum: 3 };
    properties.iss_score = { type: "integer", minimum: 0, maximum: 3 };
    properties.score_date = {
      type: "string",
      format: "date",
      description:
        "Chỉ ngày hôm nay theo Asia/Bangkok; bỏ qua để server lấy hôm nay.",
    };
    return described(
      object(properties, ["hss_score", "iss_score"]),
      { hss_score: 2, iss_score: 1 },
      "Chỉ bệnh nhân ghi điểm của mình. Tổng UAS do PostgreSQL tính, không gửi tổng điểm. cycle_id và day_in_cycle phải khớp chu kỳ thuộc bệnh nhân.",
    );
  }
  if (action === "prescribe") {
    const medicine = {
      ...object(
        {
          medicine_id: text("Mã thuốc trong danh mục", { maxLength: 50 }),
          name: text("Tên thuốc bổ sung", { minLength: 1, maxLength: 255 }),
          dosage: text("Liều dùng", { minLength: 1, maxLength: 100 }),
          duration: text("Thời gian dùng", { minLength: 1, maxLength: 100 }),
        },
        ["dosage", "duration"],
      ),
      anyOf: [
        {
          required: ["medicine_id"],
          properties: { medicine_id: { type: "string", minLength: 1 } },
        },
        { required: ["name"] },
      ],
    };
    return described(
      object(
        {
          medical_record_id: idSchema(),
          notes: text("Ghi chú điều trị", { maxLength: 100000 }),
          medicines: {
            type: "array",
            minItems: 1,
            maxItems: 100,
            items: medicine,
          },
        },
        ["medical_record_id", "medicines"],
      ),
      {
        medical_record_id: "1",
        notes: "Ghi chú của bác sĩ",
        medicines: [
          {
            name: "Tên thuốc do bác sĩ chỉ định",
            dosage: "Liều dùng do bác sĩ chỉ định",
            duration: "Thời gian do bác sĩ chỉ định",
          },
        ],
      },
      "Chỉ bác sĩ phụ trách được kê đơn khi hồ sơ in_progress. Mỗi thuốc cần medicine_id hoặc name; không dùng ví dụ này làm chỉ định điều trị.",
    );
  }
  if (action === "upload")
    return described(
      object(
        {
          image: {
            type: "string",
            format: "binary",
            description: "Ảnh JPEG/PNG/WebP hợp lệ, tối đa 8 MiB.",
          },
          medical_record_id: idSchema(),
          purpose: text("Mục đích", { maxLength: 100 }),
          description: text("Mô tả", { maxLength: 100000 }),
        },
        ["image", "medical_record_id"],
      ),
      { medical_record_id: "1", description: "Ảnh theo dõi tổn thương" },
      "multipart/form-data: chọn tệp bằng nút Choose File và thay medical_record_id bằng hồ sơ có quyền truy cập.",
    );
  if (action === "photoCreate") {
    const schema = resourceDocumentation("photos");
    schema.required = ["attachment_id", "taken_at"];
    schema.anyOf = [
      { required: ["episode_id"] },
      { required: ["location_id"] },
    ];
    schema.properties!.milestone = {
      type: "string",
      enum: ["start", "peak", "normal"],
    };
    return described(
      schema,
      {
        attachment_id: "1",
        location_id: "1",
        taken_at: "2026-11-01T09:00:00+07:00",
        milestone: "start",
        itch_score: 2,
      },
      "Tải ảnh vào kho trước. Cần episode_id hoặc location_id; ảnh và tổn thương phải cùng bệnh nhân/bệnh án. Các điểm triệu chứng từ 0 đến 10.",
    );
  }
  if (action === "milestone")
    return described(
      object(
        { milestone: { type: "string", enum: ["start", "peak", "normal"] } },
        ["milestone"],
      ),
      { milestone: "peak" },
    );
  if (endpoint.resource && ["create", "update"].includes(action)) {
    const schema = resourceDocumentation(
      endpoint.resource,
      action === "update",
    );
    const samples: Record<string, Record<string, unknown>> = {
      branches: { name: "Chi nhánh A", address: "Địa chỉ cơ sở" },
      departments: { name: "Khoa khám bệnh", type: "KHOA", branch_id: "1" },
      rooms: { name: "Phòng khám 01", department_id: "1" },
      roles: { name: "data_entry", display_name: "Nhập liệu" },
      permissions: { name: "view_records", description: "Xem hồ sơ" },
      episodes: {
        patient_id: "1",
        medical_record_id: "1",
        name: "Đợt tổn thương 1",
      },
      locations: { episode_id: "1", body_location: "Cánh tay" },
    };
    const sample =
      samples[endpoint.resource] ??
      (valueFor(schema) as Record<string, unknown>);
    const updateSample = Object.fromEntries(
      Object.entries(sample).filter(([k]) => k in schema.properties!),
    );
    return described(schema, action === "update" ? updateSample : sample);
  }
  throw new Error(`Missing request documentation for ${endpoint.source}`);
}
