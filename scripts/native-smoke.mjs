// Full HTTP integration on a disposable database restored from the supplied dump.
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import assert from "node:assert/strict";
import "dotenv/config";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.startsWith("/mayday_test_"))
  throw new Error(
    "TEST_DATABASE_URL must point to a disposable mayday_test_* database restored from mayday_backup.sql",
  );
const db = new PrismaClient({ datasources: { db: { url } } });
const temp = mkdtempSync(join(tmpdir(), "mayday-smoke-"));
const port = process.env.SMOKE_PORT || "3111";
const password = "MaydayFixture2026!";
const suffix = Date.now();
let server,
  logs = "";
const results = [];
async function check(name, run) {
  await run();
  results.push({ name, passed: true });
  console.log(`PASS ${name}`);
}
async function request(
  path,
  { token, body, method = "GET", status = 200 } = {},
) {
  const response = await fetch(`http://127.0.0.1:${port}/api/v1${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  assert.equal(
    response.status,
    status,
    `${method} ${path}: ${JSON.stringify(data)}`,
  );
  return data;
}
try {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(Number(port), "127.0.0.1", () => probe.close(resolve));
  });
  const roles = await db.vaitro.findMany();
  const branch = await db.chinhanh.findFirst();
  async function account(role, phone) {
    const person = await db.nguoi.create({
      data: { ho_ten: `Test ${role}`, so_dien_thoai: phone },
    });
    if (role === "benh_nhan")
      await db.benhnhan.create({ data: { ma_benh_nhan: person.ma_nguoi } });
    else
      await db.nhanvien.create({
        data: {
          ma_nhan_vien: person.ma_nguoi,
          ma_chi_nhanh: branch.ma_chi_nhanh,
        },
      });
    const user = await db.taikhoan.create({
      data: {
        ma_nguoi: person.ma_nguoi,
        ma_vai_tro: roles.find((r) => r.ten_vai_tro === role).ma_vai_tro,
        ten_dang_nhap: `test_${role}_${phone}_${suffix}`,
        mat_khau_ma_hoa: await hash(password, 10),
      },
    });
    return { person, user };
  }
  const admin = await account("admin", "0999999001"),
    doctor = await account("bac_si", "0999999002"),
    patient = await account("benh_nhan", "0999999003"),
    other = await account("benh_nhan", "0999999004");
  server = spawn(process.execPath, ["apps/api/dist/main.js"], {
    env: {
      ...process.env,
      DATABASE_URL: url,
      PORT: port,
      SESSION_FILE: join(temp, "sessions.json"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => (logs += chunk));
  server.stderr.on("data", (chunk) => (logs += chunk));
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null)
      throw new Error("Test API exited before readiness");
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
      if (r.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  let adminToken, doctorToken, patientToken, otherToken;
  await check(
    "login with existing bcrypt accounts and no password disclosure",
    async () => {
      for (const [a, set] of [
        [admin, (t) => (adminToken = t)],
        [doctor, (t) => (doctorToken = t)],
        [patient, (t) => (patientToken = t)],
        [other, (t) => (otherToken = t)],
      ]) {
        const r = await request("/auth/login", {
          method: "POST",
          body: { identifier: a.user.ten_dang_nhap, password },
        });
        assert.ok(r.data.token);
        assert.equal(JSON.stringify(r).includes("mat_khau_ma_hoa"), false);
        set(r.data.token);
      }
    },
  );
  let schema;
  await check(
    "all 44 native tables support schema and list reads",
    async () => {
      schema = (await request("/data/schema", { token: adminToken })).data;
      assert.equal(schema.length, 44);
      for (const t of schema)
        await request(`/data/${t.name}`, { token: adminToken });
    },
  );
  let cap, man, visit;
  const create = async (table, body, token = adminToken) =>
    (
      await request(`/data/${table}`, {
        method: "POST",
        body,
        token,
        status: 201,
      })
    ).data;
  await check(
    "acute and chronic records create required subtype rows",
    async () => {
      cap = await create("hosobenhan", {
        ma_benh_nhan: String(patient.person.ma_nguoi),
        loai_benh_an: "CAP",
      });
      man = await create("hosobenhan", {
        ma_benh_nhan: String(patient.person.ma_nguoi),
        loai_benh_an: "MAN",
      });
      assert.ok(
        await db.benhanmaydaycap.findUnique({
          where: { ma_ho_so: BigInt(cap.ma_ho_so) },
        }),
      );
      assert.ok(
        await db.benhanmaydayman.findUnique({
          where: { ma_ho_so: BigInt(man.ma_ho_so) },
        }),
      );
    },
  );
  await check(
    "visits and lab results persist parent/subtype atomically",
    async () => {
      visit = await create(
        "phienkham",
        {
          ma_ho_so: man.ma_ho_so,
          ma_bac_si: String(doctor.person.ma_nguoi),
          loai_benh_an: "MAN",
          ngay_kham: "2026-10-28",
          lan_kham_thu: 1,
        },
        doctorToken,
      );
      const lab = await create(
        "ketquacanlamsang",
        {
          ma_phien_kham: visit.ma_phien_kham,
          loai_ket_qua_can_lam_sang: "MAN",
          wbc: "7.25",
        },
        doctorToken,
      );
      assert.ok(
        await db.ketquacanlamsangman.findUnique({
          where: {
            ma_ket_qua_can_lam_sang: BigInt(lab.ma_ket_qua_can_lam_sang),
          },
        }),
      );
    },
  );
  await check("prescriptions use the native drug/dosage model", async () => {
    const rx = await create(
      "donthuoc",
      {
        ma_ho_so: man.ma_ho_so,
        ma_phien_kham: visit.ma_phien_kham,
        ghi_chu_dieu_tri: "Fixture",
      },
      doctorToken,
    );
    const item = await create(
      "chitietdonthuoc",
      {
        ma_don_thuoc: rx.ma_don_thuoc,
        ten_thuoc_bo_sung: "Fixture medicine",
        lieu_dung: "Fixture dose",
        thoi_gian_dung: "Fixture duration",
      },
      doctorToken,
    );
    assert.equal(item.ten_thuoc_bo_sung, "Fixture medicine");
  });
  await check(
    "patient writes daily UAS and database calculates total",
    async () => {
      const score = await create(
        "nhatkyuashangngay",
        {
          ma_benh_nhan: String(patient.person.ma_nguoi),
          ma_ho_so_man: man.ma_ho_so,
          ngay_cham_diem: "2026-10-28",
          diem_ngua_iss: 2,
          diem_san_phu_hss: 3,
        },
        patientToken,
      );
      assert.equal(score.diem_uas_ngay, 5);
      await request(
        `/data/nhatkyuashangngay/${encodeURIComponent(score._key)}`,
        {
          method: "PATCH",
          token: patientToken,
          body: { diem_uas_ngay: 6 },
          status: 400,
        },
      );
    },
  );
  await check(
    "patient cannot read foreign records, link foreign records or change roles",
    async () => {
      await request(`/data/hosobenhan/${encodeURIComponent(man._key)}`, {
        token: otherToken,
        status: 404,
      });
      const rows = (await request("/data/hosobenhan", { token: otherToken }))
        .data;
      assert.equal(rows.length, 0);
      await request("/data/nhatkyuashangngay", {
        token: otherToken,
        method: "POST",
        body: {
          ma_ho_so_man: man.ma_ho_so,
          ngay_cham_diem: "2026-10-28",
          diem_ngua_iss: 1,
          diem_san_phu_hss: 1,
        },
        status: 403,
      });
      await request("/data/taikhoan", { token: patientToken, status: 403 });
    },
  );
  await check(
    "invalid updates and unsafe table names are rejected",
    async () => {
      await request(`/data/hosobenhan/${encodeURIComponent(man._key)}`, {
        token: doctorToken,
        method: "PATCH",
        body: { ma_benh_nhan: String(other.person.ma_nguoi) },
        status: 400,
      });
      await request("/data/not_a_table", { token: adminToken, status: 404 });
      await request("/data/nhatkyuashangngay", {
        token: adminToken,
        method: "POST",
        body: {
          ma_benh_nhan: String(patient.person.ma_nguoi),
          ngay_cham_diem: "2026-10-29",
          diem_ngua_iss: 7,
          diem_san_phu_hss: 3,
        },
        status: 409,
      });
    },
  );
  await check(
    "password changes revoke old sessions and logout is durable",
    async () => {
      await request("/auth/change-password", {
        token: patientToken,
        method: "POST",
        body: { old_password: password, new_password: "NewMaydayFixture2026!" },
      });
      await request("/auth/me", { token: patientToken, status: 401 });
      const login = await request("/auth/login", {
        method: "POST",
        body: {
          identifier: patient.user.ten_dang_nhap,
          password: "NewMaydayFixture2026!",
        },
      });
      await request("/auth/logout", {
        token: login.data.token,
        method: "POST",
        body: {},
      });
      await request("/auth/me", { token: login.data.token, status: 401 });
    },
  );
  writeFileSync(
    "docs/database-verification.json",
    JSON.stringify(
      { tested_at: new Date().toISOString(), tables: 44, checks: results },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `${results.length} HTTP integration checks passed; source database was not used for writes.`,
  );
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  server?.kill();
  await db.$disconnect();
}
