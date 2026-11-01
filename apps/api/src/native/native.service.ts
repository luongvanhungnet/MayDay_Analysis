import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { compare, hash } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { PrismaService } from "../common/prisma.service";
import { DomainException } from "../common/domain.exception";
import {
  Actor,
  automaticSubtypes,
  canRead,
  canWrite,
  choices,
  dictionaries,
  Table,
  table,
  tables,
  writable,
  writableData,
} from "./schema";
import { ownershipPath } from "./ownership";

type Row = Record<string, unknown>;
type Session = { accountId: string; fingerprint: string; expires: number };
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const identifier = (s: string) => Prisma.raw(`"${s.replace(/"/g, '""')}"`);
const sqlTable = (t: Table) => Prisma.sql`public.${identifier(t.name)}`;
const valueSql = (t: Table, name: string, value: unknown) =>
  Prisma.sql`${value}::${Prisma.raw(t.columns.find((c) => c.name === name)!.type)}`;
const requireValue = (v: unknown, name: string, max = 200) => {
  if (typeof v !== "string" || !v.trim() || v.length > max)
    throw new DomainException(2003, `${name} không hợp lệ`);
  return v.trim();
};

@Injectable()
export class NativeService {
  private readonly sessionFile = resolve(
    process.env.SESSION_FILE ||
      resolve(__dirname, "../../../../.data/sessions.json"),
  );
  private sessions: Record<string, Session> = {};
  private attempts = new Map<string, { count: number; reset: number }>();
  constructor(private readonly db: PrismaService) {
    if (existsSync(this.sessionFile))
      this.sessions = JSON.parse(readFileSync(this.sessionFile, "utf8"));
  }
  private persist() {
    this.sessions = Object.fromEntries(
      Object.entries(this.sessions).filter(([, s]) => s.expires > Date.now()),
    );
    mkdirSync(dirname(this.sessionFile), { recursive: true });
    writeFileSync(`${this.sessionFile}.tmp`, JSON.stringify(this.sessions), {
      mode: 0o600,
    });
    renameSync(`${this.sessionFile}.tmp`, this.sessionFile);
  }
  private async account(id: string) {
    const rows = await this.db.$queryRaw<Row[]>(
      Prisma.sql`SELECT t.*, n.ho_ten, n.so_dien_thoai, v.ten_vai_tro FROM taikhoan t JOIN nguoi n USING(ma_nguoi) JOIN vaitro v USING(ma_vai_tro) WHERE t.ma_tai_khoan=${id}::bigint`,
    );
    return rows[0];
  }
  private fingerprint(row: Row) {
    return digest(`${row.mat_khau_ma_hoa}:${row.ma_nguoi}:${row.ma_vai_tro}`);
  }
  async authenticate(bearer?: string): Promise<Actor> {
    const token = bearer?.match(/^Bearer (\S+)$/i)?.[1];
    const session = token ? this.sessions[digest(token)] : undefined;
    if (!session || session.expires <= Date.now())
      throw new DomainException(3003, "Phiên đăng nhập đã hết hạn", 401);
    const row = await this.account(session.accountId);
    if (
      !row?.trang_thai_hoat_dong ||
      this.fingerprint(row) !== session.fingerprint
    )
      throw new DomainException(
        3001,
        "Tài khoản hoặc mật khẩu đã thay đổi. Vui lòng đăng nhập lại.",
        401,
      );
    return {
      accountId: String(row.ma_tai_khoan),
      personId: String(row.ma_nguoi),
      role: String(row.ten_vai_tro),
    };
  }
  async login(raw: Row, ip: string) {
    const name = requireValue(
      raw.identifier ?? raw.phone ?? raw.username,
      "Tên đăng nhập",
    );
    const password = raw.password;
    if (
      typeof password !== "string" ||
      !password ||
      Buffer.byteLength(password) > 72
    )
      throw new DomainException(2003, "Mật khẩu không hợp lệ");
    const now = Date.now();
    for (const [key, value] of this.attempts)
      if (value.reset < now) this.attempts.delete(key);
    const attempt = this.attempts.get(ip) ?? { count: 0, reset: now + 60000 };
    if (++attempt.count > 15)
      throw new DomainException(3004, "Thử lại sau một phút", 429);
    this.attempts.set(ip, attempt);
    const rows = await this.db.$queryRaw<Row[]>(
      Prisma.sql`SELECT t.* FROM taikhoan t JOIN nguoi n USING(ma_nguoi) WHERE lower(t.ten_dang_nhap)=lower(${name}) OR n.so_dien_thoai=${name} ORDER BY (lower(t.ten_dang_nhap)=lower(${name})) DESC LIMIT 2`,
    );
    // A phone can belong to more than one account; require the unambiguous username.
    const row =
      rows.find(
        (row) => String(row.ten_dang_nhap).toLowerCase() === name.toLowerCase(),
      ) ?? (rows.length === 1 ? rows[0] : undefined);
    const valid = await compare(
      password,
      String(
        row?.mat_khau_ma_hoa ??
          "$2a$12$J1vObYJQhUkx2uPUfAYn/uCMncM.KZr/RqTsZXxbM1IYsmSg4jDq.",
      ),
    );
    if (!row || !valid || !row.trang_thai_hoat_dong)
      throw new DomainException(
        3008,
        "Tên đăng nhập hoặc mật khẩu không đúng",
        401,
      );
    const token = randomBytes(32).toString("base64url");
    const account = await this.account(String(row.ma_tai_khoan));
    this.sessions[digest(token)] = {
      accountId: String(row.ma_tai_khoan),
      fingerprint: this.fingerprint(account),
      expires: now + 7200000,
    };
    this.persist();
    return {
      token,
      user: await this.profile({
        accountId: String(row.ma_tai_khoan),
        personId: String(row.ma_nguoi),
        role: String(account.ten_vai_tro),
      }),
    };
  }
  logout(header: string) {
    const token = header.match(/^Bearer (\S+)$/i)?.[1];
    if (token) delete this.sessions[digest(token)];
    this.persist();
    return { logged_out: true };
  }
  async profile(actor: Actor) {
    const a = await this.account(actor.accountId);
    return {
      id: String(a.ma_tai_khoan),
      person_id: String(a.ma_nguoi),
      full_name: a.ho_ten,
      phone: a.so_dien_thoai,
      role: a.ten_vai_tro,
      username: a.ten_dang_nhap,
      role_id: String(a.ma_vai_tro),
      is_active: a.trang_thai_hoat_dong,
    };
  }
  async changePassword(actor: Actor, raw: Row) {
    const account = await this.account(actor.accountId);
    if (
      typeof raw.old_password !== "string" ||
      !(await compare(raw.old_password, String(account.mat_khau_ma_hoa)))
    )
      throw new DomainException(3009, "Mật khẩu cũ không đúng");
    const password = raw.new_password;
    if (
      typeof password !== "string" ||
      password.length < 10 ||
      Buffer.byteLength(password) > 72
    )
      throw new DomainException(2003, "Mật khẩu mới cần 10–72 byte");
    const encoded = await hash(password, 12);
    await this.db
      .$executeRaw`UPDATE taikhoan SET mat_khau_ma_hoa=${encoded} WHERE ma_tai_khoan=${actor.accountId}::bigint`;
    return { changed: true, reauthenticate: true };
  }
  schema(actor: Actor) {
    return tables
      .filter((t) => canRead(actor, t))
      .map((t) => ({
        ...t,
        checks: t.checks,
        columns: t.columns
          .filter((c) => c.name !== "mat_khau_ma_hoa")
          .map((c) => ({
            ...c,
            writable: writable(c),
            options: choices(t, c),
          })),
        can_write: canWrite(actor, t),
        can_create: canWrite(actor, t) && !automaticSubtypes.has(t.name),
        can_delete: actor.role === "admin" && dictionaries.has(t.name),
      }));
  }
  private scope(t: Table, actor: Actor, alias = "r"): Prisma.Sql {
    if (actor.role !== "benh_nhan") return Prisma.sql`TRUE`;
    if (dictionaries.has(t.name)) return Prisma.sql`TRUE`;
    if (t.name === "nguoi")
      return Prisma.sql`${identifier(alias)}.ma_nguoi=${actor.personId}::bigint`;
    const path = ownershipPath(t.name);
    if (!path) return Prisma.sql`FALSE`;
    if (!path.length)
      return Prisma.sql`${identifier(alias)}.ma_benh_nhan=${actor.personId}::bigint`;
    const next = (i: number, previous: string): Prisma.Sql => {
      const rel = path[i],
        name = `owner_${i}`;
      const links = rel.columns.map(
        (c, j) =>
          Prisma.sql`${identifier(previous)}.${identifier(c)}=${identifier(name)}.${identifier(rel.references[j])}`,
      );
      const tail =
        i === path.length - 1
          ? Prisma.sql`${identifier(name)}.ma_benh_nhan=${actor.personId}::bigint`
          : next(i + 1, name);
      return Prisma.sql`EXISTS (SELECT 1 FROM public.${identifier(rel.table)} ${identifier(name)} WHERE ${Prisma.join(links, " AND ")} AND ${tail})`;
    };
    return next(0, alias);
  }
  private select(t: Table) {
    return Prisma.join([
      ...t.columns
        .filter((c) => c.name !== "mat_khau_ma_hoa")
        .map((c) =>
          c.type === "interval" || c.type === "date"
            ? Prisma.sql`r.${identifier(c.name)}::text AS ${identifier(c.name)}`
            : Prisma.sql`r.${identifier(c.name)}`,
        ),
      Prisma.sql`${this.rowLabel(t)} AS _label`,
    ]);
  }
  private rowLabel(t: Table): Prisma.Sql {
    if (["benhnhan", "nhanvien"].includes(t.name)) {
      const key = t.name === "benhnhan" ? "ma_benh_nhan" : "ma_nhan_vien";
      return Prisma.sql`(SELECT n.ho_ten || ' · ' || n.so_dien_thoai FROM nguoi n WHERE n.ma_nguoi=r.${identifier(key)})`;
    }
    if (t.name === "hosobenhan")
      return Prisma.sql`(SELECT n.ho_ten || ' · ' || r.loai_benh_an FROM nguoi n WHERE n.ma_nguoi=r.ma_benh_nhan)`;
    if (t.name === "phienkham")
      return Prisma.sql`(SELECT n.ho_ten || ' · ' || r.ngay_kham::text FROM hosobenhan h JOIN nguoi n ON n.ma_nguoi=h.ma_benh_nhan WHERE h.ma_ho_so=r.ma_ho_so)`;
    const name = t.columns.find((c) =>
      [
        "ho_ten",
        "ten_thuoc",
        "ten_chi_nhanh",
        "ten_khoa_phong",
        "ten_phong_kham",
        "ten_hien_thi",
        "ten_dang_nhap",
        "ten_dot_ton_thuong_da",
        "vi_tri_co_the",
        "ten_tep_goc",
        "ten_nghiem_phap",
        "ten_dac_diem",
        "ten_quyen_han",
      ].includes(c.name),
    );
    return name
      ? Prisma.sql`r.${identifier(name.name)}::text`
      : Prisma.sql`NULL::text`;
  }
  private view(t: Table, r: Row): Row & { _key: string } {
    return {
      ...r,
      _key: JSON.stringify(
        Object.fromEntries(
          t.columns.filter((c) => c.pk).map((c) => [c.name, String(r[c.name])]),
        ),
      ),
    };
  }
  private key(t: Table, key: string) {
    let parsed: Row;
    try {
      parsed = JSON.parse(key);
    } catch {
      throw new DomainException(2003, "Mã bản ghi không hợp lệ");
    }
    const pk = t.columns.filter((c) => c.pk);
    if (
      !parsed ||
      Object.keys(parsed).length !== pk.length ||
      pk.some((c) => typeof parsed[c.name] !== "string")
    )
      throw new DomainException(2003, "Mã bản ghi không hợp lệ");
    return Prisma.join(
      pk.map(
        (c) =>
          Prisma.sql`r.${identifier(c.name)}=${valueSql(t, c.name, parsed[c.name])}`,
      ),
      " AND ",
    );
  }
  async list(actor: Actor, name: string, query: Row) {
    const t = table(name);
    if (!canRead(actor, t))
      throw new DomainException(3101, "Không có quyền truy cập", 403);
    const page = Math.max(
      1,
      Math.min(100000, Math.trunc(Number(query.page) || 1)),
    );
    const limit = Math.max(
      1,
      Math.min(100, Math.trunc(Number(query.limit) || 25)),
    );
    const search = String(query.search || "").slice(0, 200);
    const textColumns = t.columns.filter(
      (c) =>
        !c.generated &&
        c.name !== "mat_khau_ma_hoa" &&
        /^(text|character varying)/.test(c.type),
    );
    const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    const searchClause = search
      ? Prisma.sql`(${Prisma.join([...textColumns.map((c) => Prisma.sql`r.${identifier(c.name)} ILIKE ${pattern}`), Prisma.sql`${this.rowLabel(t)} ILIKE ${pattern}`], " OR ")})`
      : Prisma.sql`TRUE`;
    let filters: Row = {};
    try {
      if (query.filter) filters = JSON.parse(String(query.filter));
      if (!filters || typeof filters !== "object" || Array.isArray(filters))
        throw new Error();
    } catch {
      throw new DomainException(2003, "Bộ lọc không hợp lệ");
    }
    const filterClauses = Object.entries(filters).map(([k, v]) => {
      if (!t.columns.some((c) => c.name === k && c.name !== "mat_khau_ma_hoa"))
        throw new DomainException(2003, "Bộ lọc không hợp lệ");
      return Prisma.sql`r.${identifier(k)}=${valueSql(t, k, v)}`;
    });
    const where = Prisma.sql`${this.scope(t, actor)} AND ${searchClause} ${filterClauses.length ? Prisma.sql`AND ${Prisma.join(filterClauses, " AND ")}` : Prisma.empty}`;
    const order = Prisma.join(
      t.columns
        .filter((c) => c.pk)
        .map((c) => Prisma.sql`r.${identifier(c.name)}`),
    );
    const [data, count] = await this.db.$transaction([
      this.db.$queryRaw<Row[]>(
        Prisma.sql`SELECT ${this.select(t)} FROM ${sqlTable(t)} r WHERE ${where} ORDER BY ${order} DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      ),
      this.db.$queryRaw<{ total: bigint }[]>(
        Prisma.sql`SELECT count(*) AS total FROM ${sqlTable(t)} r WHERE ${where}`,
      ),
    ]);
    return {
      data: data.map((r) => this.view(t, r)),
      meta: {
        page,
        limit,
        total: Number(count[0].total),
        total_pages: Math.ceil(Number(count[0].total) / limit),
      },
    };
  }
  async detail(
    actor: Actor,
    name: string,
    key: string,
    db: Prisma.TransactionClient = this.db,
  ) {
    const t = table(name);
    if (!canRead(actor, t))
      throw new DomainException(3101, "Không có quyền truy cập", 403);
    const rows = await db.$queryRaw<Row[]>(
      Prisma.sql`SELECT ${this.select(t)} FROM ${sqlTable(t)} r WHERE ${this.key(t, key)} AND ${this.scope(t, actor)}`,
    );
    if (!rows[0])
      throw new DomainException(4004, "Không tìm thấy bản ghi", 404);
    return this.view(t, rows[0]);
  }
  private async insert(db: Prisma.TransactionClient, t: Table, data: Row) {
    const entries = Object.entries(data);
    const rows = await db.$queryRaw<Row[]>(
      entries.length
        ? Prisma.sql`INSERT INTO ${sqlTable(t)} (${Prisma.join(entries.map(([k]) => identifier(k)))}) VALUES (${Prisma.join(entries.map(([k, v]) => valueSql(t, k, v)))}) RETURNING ${Prisma.join(t.columns.filter((c) => c.pk).map((c) => identifier(c.name)))}`
        : Prisma.sql`INSERT INTO ${sqlTable(t)} DEFAULT VALUES RETURNING ${Prisma.join(t.columns.filter((c) => c.pk).map((c) => identifier(c.name)))}`,
    );
    return rows[0];
  }
  private async checkReferences(
    db: Prisma.TransactionClient,
    t: Table,
    data: Row,
    actor: Actor,
  ) {
    if (actor.role !== "benh_nhan") return;
    if (
      data.ma_benh_nhan !== undefined &&
      String(data.ma_benh_nhan) !== actor.personId
    )
      throw new DomainException(3101, "Chỉ được ghi dữ liệu của bạn", 403);
    for (const rel of t.relations) {
      if (
        dictionaries.has(rel.table) ||
        !rel.columns.every((c) => data[c] !== undefined && data[c] !== null)
      )
        continue;
      const target = table(rel.table);
      const clauses = rel.columns.map(
        (c, i) =>
          Prisma.sql`r.${identifier(rel.references[i])}=${valueSql(target, rel.references[i], data[c])}`,
      );
      const rows = await db.$queryRaw<Row[]>(
        Prisma.sql`SELECT 1 FROM ${sqlTable(target)} r WHERE ${Prisma.join(clauses, " AND ")} AND ${this.scope(target, actor)} LIMIT 1`,
      );
      if (!rows.length)
        throw new DomainException(
          3101,
          "Không có quyền liên kết bản ghi này",
          403,
        );
    }
  }
  private async prepare(t: Table, raw: unknown, update: boolean): Promise<Row> {
    const input =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? ({ ...raw } as Row)
        : raw;
    if (t.name === "taikhoan" && input && typeof input === "object") {
      if ("mat_khau_ma_hoa" in input)
        throw new DomainException(2003, "Dùng trường password để đặt mật khẩu");
      const { password, ...rest } = input as Row;
      const data = writableData(t, rest, update);
      if (password !== undefined || !update) {
        if (
          typeof password !== "string" ||
          password.length < 10 ||
          Buffer.byteLength(password) > 72
        )
          throw new DomainException(2003, "Mật khẩu cần 10–72 byte");
        return { ...data, mat_khau_ma_hoa: await hash(password, 12) };
      }
      return data;
    }
    return writableData(t, input, update);
  }
  async create(actor: Actor, name: string, raw: unknown) {
    const t = table(name);
    if (!canWrite(actor, t))
      throw new DomainException(3101, "Không có quyền ghi dữ liệu này", 403);
    if (automaticSubtypes.has(name))
      throw new DomainException(
        2003,
        "Phần chi tiết được tạo cùng hồ sơ/phiên khám/kết quả cha. Chọn bản ghi có sẵn để cập nhật.",
        409,
      );
    const data = await this.prepare(t, raw, false);
    if (
      actor.role === "benh_nhan" &&
      t.columns.some((c) => c.name === "ma_benh_nhan")
    )
      data.ma_benh_nhan = actor.personId;
    return this.db.$transaction(async (db) => {
      await this.checkReferences(db, t, data, actor);
      const row = await this.insert(db, t, data);
      // The dump has deferred circular FKs. Both rows must be created in one transaction.
      const subtypes: Record<string, [string, string, string]> = {
        hosobenhan: ["benhanmayday", "ma_ho_so", "loai_benh_an"],
        phienkham: ["phienkham", "ma_phien_kham", "loai_benh_an"],
        ketquacanlamsang: [
          "ketquacanlamsang",
          "ma_ket_qua_can_lam_sang",
          "loai_ket_qua_can_lam_sang",
        ],
      };
      const sub = subtypes[name];
      if (sub) {
        if (!["CAP", "MAN"].includes(String(data[sub[2]])))
          throw new DomainException(2003, "Chọn loại bệnh án CAP hoặc MAN");
        await this.insert(
          db,
          table(sub[0] + String(data[sub[2]]).toLowerCase()),
          { [sub[1]]: row[sub[1]] },
        );
      }
      return this.detail(actor, name, this.view(t, row)._key, db);
    });
  }
  async update(actor: Actor, name: string, key: string, raw: unknown) {
    const t = table(name);
    if (!canWrite(actor, t))
      throw new DomainException(3101, "Không có quyền ghi dữ liệu này", 403);
    const data = await this.prepare(t, raw, true);
    if (!Object.keys(data).length) return this.detail(actor, name, key);
    return this.db.$transaction(async (db) => {
      const current = await this.detail(actor, name, key, db);
      if (
        t.name === "taikhoan" &&
        String(current.ma_tai_khoan) === actor.accountId &&
        (data.trang_thai_hoat_dong === false ||
          (data.ma_vai_tro !== undefined &&
            String(data.ma_vai_tro) !== String(current.ma_vai_tro)))
      )
        throw new DomainException(
          2003,
          "Không thể tự khóa hoặc đổi vai trò quản trị của bạn",
        );
      await this.checkReferences(db, t, { ...current, ...data }, actor);
      await db.$executeRaw(
        Prisma.sql`UPDATE ${sqlTable(t)} r SET ${Prisma.join(Object.entries(data).map(([k, v]) => Prisma.sql`${identifier(k)}=${valueSql(t, k, v)}`))} WHERE ${this.key(t, key)} AND ${this.scope(t, actor)}`,
      );
      return this.detail(actor, name, key, db);
    });
  }
  async remove(actor: Actor, name: string, key: string) {
    const t = table(name);
    if (actor.role !== "admin" || !dictionaries.has(name))
      throw new DomainException(
        3101,
        "Chỉ xóa danh mục chưa sử dụng. Giữ lại lịch sử lâm sàng.",
        403,
      );
    await this.detail(actor, name, key);
    await this.db.$executeRaw(
      Prisma.sql`DELETE FROM ${sqlTable(t)} r WHERE ${this.key(t, key)}`,
    );
    return { deleted: true };
  }
  async createPerson(actor: Actor, raw: Row) {
    if (!["admin", "bac_si", "dieu_duong"].includes(actor.role))
      throw new DomainException(3101, "Không có quyền tạo bệnh nhân", 403);
    const person = writableData(table("nguoi"), raw.person);
    const patient = writableData(table("benhnhan"), raw.patient ?? {});
    delete patient.ma_benh_nhan;
    return this.db.$transaction(async (db) => {
      const row = await this.insert(db, table("nguoi"), person);
      await this.insert(db, table("benhnhan"), {
        ...patient,
        ma_benh_nhan: row.ma_nguoi,
      });
      return this.detail(
        actor,
        "nguoi",
        JSON.stringify({ ma_nguoi: String(row.ma_nguoi) }),
        db,
      );
    });
  }
  /** Reuse native row scoping and database FKs for the explicitly supported spec deletions. */
  async removeMapped(actor: Actor, name: string, key: string) {
    if (dictionaries.has(name)) return this.remove(actor,name,key);
    const clinical=['dottonthuongda','vitritonthuong','anhchuptonthuong','tepdinhkem'];
    const admin=['quyenhan','vaitroquyenhan'];
    if (!(clinical.includes(name) && ['admin','bac_si','benh_nhan'].includes(actor.role)) &&
        !(admin.includes(name) && actor.role==='admin'))
      throw new DomainException(3101,'Không có quyền xóa dữ liệu này',403);
    const t=table(name);
    return this.db.$transaction(async db=>{
      await this.detail(actor,name,key,db);
      const count=await db.$executeRaw(Prisma.sql`DELETE FROM ${sqlTable(t)} r WHERE ${this.key(t,key)} AND ${this.scope(t,actor)}`);
      if(!count)throw new DomainException(4004,'Không tìm thấy bản ghi',404);
      return {deleted:true};
    });
  }
}
