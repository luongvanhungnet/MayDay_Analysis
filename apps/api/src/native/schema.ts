import snapshot from "./schema.json";
import { DomainException } from "../common/domain.exception";

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  identity: boolean;
  generated: boolean;
  pk: boolean;
}
export interface Relation {
  columns: string[];
  table: string;
  references: string[];
}
export interface Table {
  name: string;
  columns: Column[];
  checks: { name: string; definition: string }[];
  relations: Relation[];
}
export const tables: Table[] = snapshot;
export function table(name: string): Table {
  const found = tables.find((t) => t.name === name);
  if (!found) throw new DomainException(4004, "Không có bảng dữ liệu này", 404);
  return found;
}
export function writable(c: Column) {
  return (
    !c.generated &&
    !c.identity &&
    !["thoi_diem_tao", "thoi_diem_cap_nhat"].includes(c.name)
  );
}
export function writableData(
  t: Table,
  raw: unknown,
  update = false,
): Record<string, string | number | boolean | null> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new DomainException(2003, "Dữ liệu phải là một đối tượng");
  const out: Record<string, string | number | boolean | null> = {};
  for (const [name, value] of Object.entries(raw)) {
    const c = t.columns.find((c) => c.name === name);
    if (
      !c ||
      !writable(c) ||
      (update &&
        (c.pk ||
          [
            "ma_benh_nhan",
            "ma_nguoi",
            "ma_ho_so",
            "ma_phien_kham",
            "loai_benh_an",
            "loai_ket_qua_can_lam_sang",
          ].includes(name)))
    )
      throw new DomainException(2003, `Không được ghi trường ${name}`);
    if (value === null) {
      if (!c.nullable)
        throw new DomainException(2003, `${name} không được để trống`);
      out[name] = null;
      continue;
    }
    if (c.type === "bigint") {
      if (
        (typeof value === "number" && !Number.isSafeInteger(value)) ||
        !/^-?\d+$/.test(String(value)) ||
        BigInt(String(value)) > 9223372036854775807n ||
        BigInt(String(value)) < -9223372036854775808n
      )
        throw new DomainException(2003, `${name}: mã số không hợp lệ`);
      out[name] = String(value);
    } else if (c.type === "boolean") {
      if (typeof value !== "boolean")
        throw new DomainException(2003, `${name}: cần giá trị có/không`);
      out[name] = value;
    } else if (/^(numeric|smallint|integer|real|double)/.test(c.type)) {
      if (
        !["string", "number"].includes(typeof value) ||
        String(value).trim() === "" ||
        !Number.isFinite(Number(value)) ||
        (/^(smallint|integer)/.test(c.type) && !Number.isInteger(Number(value)))
      )
        throw new DomainException(2003, `${name}: cần giá trị số hợp lệ`);
      out[name] = value as string | number;
    } else {
      if (typeof value !== "string" || value.length > 100000)
        throw new DomainException(2003, `${name}: giá trị không hợp lệ`);
      const max = c.type.match(/character varying\((\d+)\)/)?.[1];
      if (max && value.length > Number(max))
        throw new DomainException(2003, `${name}: tối đa ${max} ký tự`);
      if (
        c.type === "date" &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          !Number.isFinite(Date.parse(value)) ||
          new Date(value).toISOString().slice(0, 10) !== value)
      )
        throw new DomainException(2003, `${name}: ngày không hợp lệ`);
      out[name] = value;
    }
  }
  return out;
}
export function choices(t: Table, c: Column): string[] {
  const check = t.checks.find(
    (x) =>
      (x.definition.includes(`(${c.name})`) &&
        x.definition.includes("ANY (ARRAY[")) ||
      x.definition.includes(`(${c.name} = ANY (ARRAY[`),
  );
  return check
    ? [...check.definition.matchAll(/'([^']*)'/g)].map((m) => m[1])
    : [];
}
export const dictionaries = new Set([
  "chinhanh",
  "khoaphong",
  "phongkham",
  "thuoc",
  "dacdiemsanphu",
  "loainghiemphap",
]);
export const administration = new Set([
  "taikhoan",
  "vaitro",
  "quyenhan",
  "vaitroquyenhan",
  "nhanvien",
]);
export const automaticSubtypes = new Set([
  "benhanmaydaycap",
  "benhanmaydayman",
  "phienkhamcap",
  "phienkhamman",
  "ketquacanlamsangcap",
  "ketquacanlamsangman",
]);
export interface Actor {
  accountId: string;
  personId: string;
  role: string;
}
export function canRead(actor: Actor, t: Table) {
  return (
    actor.role === "admin" ||
    (["bac_si", "dieu_duong", "benh_nhan"].includes(actor.role) &&
      !administration.has(t.name))
  );
}
export function canWrite(actor: Actor, t: Table) {
  if (actor.role === "admin") return true;
  if (!["bac_si", "dieu_duong", "benh_nhan"].includes(actor.role)) return false;
  if (administration.has(t.name) || dictionaries.has(t.name)) return false;
  if (actor.role === "bac_si") return true;
  if (actor.role === "dieu_duong" && ["nguoi", "benhnhan"].includes(t.name))
    return true;
  return [
    "nhatkyuashangngay",
    "nhatkyaashangngay",
    "dottonthuongda",
    "vitritonthuong",
    "anhchuptonthuong",
    "sanglocbaodongdo",
  ].includes(t.name);
}
