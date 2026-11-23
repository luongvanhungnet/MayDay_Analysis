import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const baseUrl = process.env.NAVIGATION_BASE_URL || "http://localhost:5186";
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
  (existsSync(edge) ? edge : undefined);
const browser = await chromium.launch({ executablePath, headless: true });
const results = [];
const record = {
  id: "10",
  patient_id: "20",
  record_type: "MAN",
  status: "pending",
};
const episode = {
  id: "50",
  patient_id: "20",
  medical_record_id: "10",
  name: "Đợt theo dõi",
  onset_at: "2026-11-16T08:00:00+07:00",
};
const session = (role) => ({
  token: "navigation-fixture",
  user: {
    id: "1",
    person_id: "20",
    full_name: "Người dùng kiểm thử",
    phone: "0999999999",
    role,
  },
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
});
context.setDefaultTimeout(10000);
const errors = [];
let photoAttempts = 0;
let uploadCount = 0;
context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
await context.route("**/api/v1/**", async (route) => {
  const url = new URL(route.request().url());
  const path = url.pathname.replace("/api/v1", "");
  let data = [];
  let meta;
  if (path === "/data/schema") data = [];
  else if (path === "/auth/login") data = session("benh_nhan");
  else if (path === "/medical_records/all" || path.endsWith("/history")) {
    data = [record];
    meta = {
      page: Number(url.searchParams.get("page") || 1),
      limit: 25,
      total: 100,
      total_pages: 4,
    };
  } else if (
    path === "/medical_records/10" ||
    path === "/medical_records/10/summary"
  )
    data = {
      ...record,
      latest_visit:
        record.status === "pending"
          ? null
          : { id: "30", assigned_doctor_id: "20" },
    };
  else if (path === "/medical_records/10/accept") {
    record.status = "in_progress";
    data = record;
  } else if (path === "/uas7-scores/eligibility")
    data = { eligible: true, medical_record_ids: ["10"] };
  else if (path === "/doctor/patients/search")
    data = [{ id: "20", full_name: "Bệnh nhân kiểm thử", phone: "0999999999" }];
  else if (path === "/lesion-episodes/my") data = [episode];
  else if (path === "/lesion-episodes/50") data = episode;
  else if (path === "/lesion-locations/episode/50")
    data = [{ id: "60", episode_id: "50", body_location: "Cánh tay" }];
  else if (path === "/data/dottonthuongda")
    data = [
      {
        ma_dot_ton_thuong_da: "50",
        ma_benh_nhan: "20",
        ma_ho_so_man: "10",
        ten_dot_ton_thuong_da: "Đợt theo dõi",
      },
    ];
  else if (path === "/image-attachments/upload") {
    uploadCount++;
    data = { id: "70", medical_record_id: "10", file_name: "test.png" };
  } else if (path.startsWith("/image-attachments/user/"))
    data = [{ id: "70", medical_record_id: "10", file_name: "test.png" }];
  else if (path === "/lesion-photos" && route.request().method() === "POST") {
    if (++photoAttempts === 1) {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          code: 7006,
          message: "Không thể gắn ảnh ở lần thử này",
          data: null,
        }),
      });
      return;
    }
    data = { id: "80", ...route.request().postDataJSON() };
    assert.equal(data.attachment_id, "70");
  }
  await route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ code: 1000, data, ...(meta ? { meta } : {}) }),
  });
});
async function pageFor(role, search = "") {
  const page = await context.newPage();
  await page.addInitScript(
    (s) => sessionStorage.setItem("mayday.session", JSON.stringify(s)),
    session(role),
  );
  await page.goto(baseUrl + "/" + search);
  return page;
}
try {
  for (const [role, heading] of [
    ["benh_nhan", "Hôm nay"],
    ["bac_si", "Hồ sơ bệnh án"],
    ["dieu_duong", "Bệnh nhân"],
    ["admin", "Tổng quan quản trị"],
  ]) {
    const page = await pageFor(role);
    await page.getByRole("heading", { name: heading, exact: true }).waitFor();
    results.push({ name: `landing ${role}`, passed: true });
    await page.close();
  }
  const page = await pageFor("bac_si", "?view=records&status=pending&page=3");
  await page.getByRole("button", { name: "Mở hồ sơ", exact: true }).click();
  await page.getByRole("region", { name: "Hồ sơ #10", exact: true }).waitFor();
  await page.getByRole("button", { name: "Kết quả", exact: true }).click();
  await page.reload();
  await page.getByText("Chưa có kết quả xét nghiệm.").waitFor();
  assert.equal(new URL(page.url()).searchParams.get("tab"), "labs");
  await page.goBack();
  await page.getByRole("button", { name: "Mở hồ sơ", exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("page"), "3");
  assert.equal(
    await page.getByRole("combobox", { name: "Trạng thái" }).inputValue(),
    "pending",
  );
  await page.goForward();
  await page.getByRole("region", { name: "Hồ sơ #10", exact: true }).waitFor();
  results.push({
    name: "record bookmark reload, browser back/forward and list filters",
    passed: true,
  });
  await page
    .getByRole("button", { name: "Tiếp nhận khám", exact: true })
    .click();
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await page.getByRole("button", { name: "Kê đơn thuốc", exact: true }).click();
  await page.getByRole("dialog", { name: "Kê đơn · Hồ sơ #10" }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("region", { name: "Hồ sơ #10", exact: true }).waitFor();
  results.push({
    name: "accept then prescribe, Escape retains record",
    passed: true,
  });
  await page.getByRole("button", { name: "Kê đơn thuốc", exact: true }).click();
  const prescription = page.getByRole("dialog", { name: "Kê đơn · Hồ sơ #10" });
  await prescription
    .getByLabel("Ghi chú điều trị", { exact: false })
    .fill("Thay đổi chưa lưu");
  await page.goBack();
  const confirmation = page.getByRole("dialog", {
    name: "Xác nhận thao tác",
    exact: true,
  });
  await confirmation.waitFor();
  await confirmation.getByRole("button", { name: "Hủy", exact: true }).click();
  assert.equal(
    await prescription
      .getByLabel("Ghi chú điều trị", { exact: false })
      .inputValue(),
    "Thay đổi chưa lưu",
  );
  assert.equal(new URL(page.url()).searchParams.get("record"), "10");
  await page.keyboard.press("Escape");
  await confirmation
    .getByRole("button", { name: "Xác nhận", exact: true })
    .click();
  await prescription.waitFor({ state: "hidden" });
  results.push({
    name: "browser Back cancellation and Escape protect unsaved prescription",
    passed: true,
  });
  await page.screenshot({
    path: ".data/navigation-check/record-desktop.png",
    fullPage: true,
  });
  await page.goto(baseUrl + "/?view=patients&patient=20");
  const journey = page.getByRole("region", { name: "Hành trình bệnh nhân" });
  await journey.getByRole("link", { name: "Nhật ký UAS", exact: true }).click();
  await page
    .getByRole("heading", { name: "Nhật ký UAS", exact: true })
    .waitFor();
  assert.equal(new URL(page.url()).searchParams.get("patient"), "20");
  results.push({
    name: "patient journey retains patient in UAS",
    passed: true,
  });
  await page.goto(
    baseUrl +
      "/?view=lesions&patient=20&medical_record=10&episode=50&location=60",
  );
  await page.getByRole("button", { name: "Tải ảnh mới", exact: true }).click();
  const upload = page.getByRole("dialog", {
    name: "Tải ảnh tổn thương",
    exact: true,
  });
  assert.equal(await upload.getByRole("combobox").inputValue(), "10");
  await upload.getByLabel(/Ảnh \(JPEG/).setInputFiles({
    name: "test.png",
    mimeType: "image/png",
    buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  });
  await upload
    .getByRole("button", { name: "Tải ảnh lên", exact: true })
    .click();
  const photo = page.getByRole("dialog", {
    name: "Ghi ảnh tiến triển",
    exact: true,
  });
  await photo.waitFor();
  assert.equal(
    await photo
      .getByRole("combobox", { name: "Ảnh trong kho của bạn" })
      .inputValue(),
    "70",
  );
  await photo
    .getByLabel("Thời điểm chụp", { exact: false })
    .fill("2026-11-16T10:30");
  await photo
    .getByLabel("Mốc tiến triển", { exact: false })
    .selectOption("start");
  await photo
    .getByRole("button", { name: "Lưu thông tin", exact: true })
    .click();
  await photo
    .getByText("Không thể gắn ảnh ở lần thử này", { exact: true })
    .waitFor();
  assert.equal(
    await photo
      .getByRole("combobox", { name: "Ảnh trong kho của bạn" })
      .inputValue(),
    "70",
  );
  await photo
    .getByRole("button", { name: "Lưu thông tin", exact: true })
    .click();
  await page.getByText("Đã lưu ảnh tiến triển.", { exact: true }).waitFor();
  assert.equal(uploadCount, 1);
  results.push({
    name: "episode/location bookmark, upload retains record and attaches uploaded image",
    passed: true,
  });
  await page.close();
  const mobile = await pageFor("benh_nhan");
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.getByRole("heading", { name: "Hôm nay", exact: true }).waitFor();
  await mobile.screenshot({
    path: ".data/navigation-check/today-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.equal(
    await mobile
      .getByRole("heading", { name: "Hôm nay", exact: true })
      .evaluate((el) => el.getBoundingClientRect().top < 250),
    true,
  );
  await mobile.getByRole("button", { name: "Menu", exact: true }).click();
  await mobile
    .getByRole("button", { name: "Nhật ký UAS", exact: true })
    .click();
  await mobile
    .getByRole("heading", { name: "Nhật ký UAS", exact: true })
    .waitFor();
  assert.equal(
    await mobile
      .getByRole("button", { name: "Menu", exact: true })
      .getAttribute("aria-expanded"),
    "false",
  );
  results.push({
    name: "patient home mobile 390px without horizontal overflow",
    passed: true,
  });
  await mobile.goto(baseUrl + "/?view=users");
  await mobile.getByText("Bạn không có quyền truy cập chức năng này").waitFor();
  results.push({
    name: "patient cannot open administration bookmark",
    passed: true,
  });
  let expired = true;
  await context.route("**/api/v1/auth/login", async (route) => {
    expired = false;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ code: 1000, data: session("benh_nhan") }),
    });
  });
  await context.route("**/api/v1/profile", async (route) => {
    if (expired) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          code: 3101,
          message: "Phiên đã hết hạn",
          data: null,
        }),
      });
    } else
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          code: 1000,
          data: { full_name: "Người dùng kiểm thử" },
        }),
      });
  });
  await mobile.goto(baseUrl + "/?view=profile");
  await mobile
    .getByRole("heading", { name: "Đăng nhập MayDay", exact: true })
    .waitFor();
  await mobile
    .getByLabel("Tên đăng nhập hoặc số điện thoại", { exact: false })
    .fill("0999999999");
  const loginPassword = mobile.locator('input[autocomplete="current-password"]');
  await loginPassword.fill("FixturePassword2026!");
  await mobile.getByRole("button", { name: "Hiện mật khẩu" }).click();
  assert.equal(await loginPassword.getAttribute("type"), "text");
  await mobile.getByRole("button", { name: "Ẩn mật khẩu" }).click();
  assert.equal(await loginPassword.getAttribute("type"), "password");
  await mobile.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await mobile
    .getByRole("heading", { name: "Hồ sơ cá nhân", exact: true })
    .waitFor();
  assert.equal(new URL(mobile.url()).searchParams.get("view"), "profile");
  results.push({
    name: "expired session returns to the requested page after login",
    passed: true,
  });
  assert.deepEqual(errors, []);
  await mkdir(".data/navigation-check", { recursive: true });
  await writeFile(
    ".data/navigation-check/results.json",
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        backend:
          "intercepted fixtures; no real patient data or database writes",
        results,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: results.length, errors }, null, 2));
} finally {
  await browser.close();
}
