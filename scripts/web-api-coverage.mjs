import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
const { endpoints } = require("../apps/api/dist/spec/catalog.js");
const groups = [
  {
    match: /^auth\/(login|logout|change-password)$/,
    view: "Đăng nhập / menu tài khoản",
    files: ["NativeApp.tsx"],
  },
  {
    match: /^auth\/signup$/,
    view: "Đăng nhập → Đăng ký bệnh nhân",
    files: ["care-account.tsx"],
  },
  {
    match: /^auth\/admin\/create-staff$/,
    view: "Tài khoản & nhân viên → Tạo nhân viên",
    files: ["care-account.tsx"],
  },
  {
    match: /^profile$/,
    view: "Hồ sơ cá nhân → Xem / sửa",
    files: ["care-account.tsx"],
  },
  {
    match: /^admin\/users/,
    view: "Tài khoản & nhân viên → Danh sách / chi tiết / tạo / sửa / khóa / phân công",
    files: ["care-account.tsx"],
  },
  {
    match: /^(roles|permissions)(\/|$)/,
    view: "Quản trị → Vai trò / Quyền hạn",
    files: ["care-model.ts", "care-ui.tsx"],
  },
  {
    match: /^role_permissions/,
    view: "Quản trị → Gán quyền cho vai trò",
    files: ["care-account.tsx"],
  },
  {
    match: /^(branches|departments|rooms)(\/|$)/,
    view: "Cơ sở khám → Chi nhánh / Khoa phòng / Phòng khám",
    files: ["care-model.ts", "care-ui.tsx"],
  },
  {
    match: /^doctor\/patients/,
    view: "Bệnh nhân → Tìm / tiếp nhận",
    files: ["care-clinical.tsx"],
  },
  {
    match: /^medical_records/,
    view: "Hồ sơ khám → Tạo / chi tiết / lịch sử / tiếp nhận / chốt",
    files: ["care-clinical.tsx"],
  },
  {
    match: /^uas7-scores/,
    view: "Hôm nay / Hành trình bệnh nhân → Nhật ký UAS",
    files: ["care-clinical.tsx"],
  },
  {
    match: /^prescriptions$/,
    view: "Chi tiết hồ sơ → Kê đơn thuốc",
    files: ["care-clinical.tsx"],
  },
  {
    match: /^lab-results/,
    view: "Chi tiết hồ sơ → Kết quả",
    files: ["care-clinical.tsx"],
  },
  {
    match: /^image-attachments/,
    view: "Kho ảnh / Ảnh tiến triển → Upload / xem danh sách / xóa",
    files: ["care-media.tsx"],
  },
  {
    match: /^lesion-episodes/,
    view: "Tổn thương & ảnh → Đợt tổn thương",
    files: ["care-media.tsx"],
  },
  {
    match: /^lesion-locations/,
    view: "Đợt tổn thương → Vị trí",
    files: ["care-media.tsx"],
  },
  {
    match: /^lesion-photos/,
    view: "Vị trí → Ảnh tiến triển → Tạo / xem / đổi mốc / xóa",
    files: ["care-media.tsx"],
  },
];
const supported = endpoints.filter((e) => e.action !== "unsupported");
const operations = [];
for (const endpoint of supported) {
  const group = groups.find((g) => g.match.test(endpoint.path));
  if (!group)
    throw new Error(
      `No UI workflow mapping: ${endpoint.method} ${endpoint.path}`,
    );
  const sources = await Promise.all(
    group.files.map((file) =>
      readFile(new URL(`../apps/web/src/${file}`, import.meta.url), "utf8"),
    ),
  );
  const fragment = "/" + endpoint.path.split(":")[0].replace(/\/$/, "");
  if (!sources.some((source) => source.includes(fragment)))
    throw new Error(
      `Missing UI API reference: ${endpoint.method} ${endpoint.path}`,
    );
  operations.push({
    method: endpoint.method,
    path: `/api/v1/${endpoint.path}`,
    action: endpoint.action,
    view: group.view,
    sources: group.files,
  });
}
const unsupported = endpoints.filter((e) => e.action === "unsupported").length;
const report = {
  timestamp: new Date().toISOString(),
  evidence:
    "Static catalog-to-UI wiring audit. This measures mapped workflow entry points, not successful browser execution of every endpoint.",
  registered: endpoints.length,
  supported: supported.length,
  uiMapped: operations.length,
  unsupported,
  supportedUiMappingPercent: (operations.length / supported.length) * 100,
  implementedSpecPercent: Number(
    ((supported.length / endpoints.length) * 100).toFixed(2),
  ),
  operations,
};
await writeFile(
  new URL("../docs/web-api-coverage.json", import.meta.url),
  JSON.stringify(report, null, 2) + "\n",
);
const lines = [
  "# Luồng điều hướng và đối chiếu API",
  "",
  `Đối chiếu tĩnh: **${operations.length}/${supported.length} chức năng được hỗ trợ có điểm vào giao diện (100%)**. Backend hiện hỗ trợ ${supported.length}/${endpoints.length} chức năng đặc tả (${report.implementedSpecPercent}%); ${unsupported} chức năng trả 501.`,
  "",
  "Đây là kiểm tra tham chiếu API và ánh xạ màn hình, không phải kết quả chạy thành công toàn bộ API từ trình duyệt. Kiểm thử HTTP backend và browser smoke được báo cáo riêng.",
  "",
  "## Điều hướng",
  "",
  "- Bệnh nhân vào Hôm nay; bác sĩ vào Hồ sơ bệnh án; điều dưỡng vào Bệnh nhân; quản trị vào Tổng quan quản trị.",
  "- URL dùng `?view=records&record=<id>&tab=labs`, `?view=patients&patient=<id>` và `?view=lesions&patient=<id>&medical_record=<id>&episode=<id>&location=<id>`. Bookmark `?table=...` cũ tiếp tục hoạt động.",
  "- Bộ lọc, tìm kiếm, phân trang và tab nằm trong URL. Back/Forward phục hồi màn hình; hộp thoại xác nhận bảo vệ biểu mẫu chưa lưu. Tải lại/rời website dùng cảnh báo của trình duyệt.",
  "- Hành trình bệnh nhân nối hồ sơ, UAS và ảnh. Ảnh có thể tải ngay trong vị trí tổn thương và gắn vào ảnh tiến triển; khi gắn lỗi, ảnh đã upload vẫn có trong kho.",
  "- Bệnh nhân chỉ xem dữ liệu của mình; menu cơ sở và hồ sơ chuyên sâu dành cho nhân viên. Server tiếp tục là nơi quyết định quyền cuối cùng.",
  "- Phân tích AI mở từ ảnh riêng tư đã tải với Bearer; ảnh/kết quả AI chưa được lưu vào bệnh án.",
  "",
  "## Kiểm tra lại",
  "",
  "```powershell",
  "npm run typecheck",
  "npm test",
  "npm run build",
  "npm run audit:web-api",
  "# Terminal riêng: khởi động web cho browser smoke:",
  "npm run dev -w @mayday/web -- --port 5186 --strictPort",
  "# Terminal khác:",
  "npm run test:navigation",
  "```",
  "",
  "Browser smoke dùng Playwright với Edge trên Windows nếu có; máy khác cần `npx playwright install chromium` hoặc `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. Có thể đặt `NAVIGATION_BASE_URL` để đổi địa chỉ web. Mọi request `/api/v1/*` trong browser smoke được chặn và trả dữ liệu fixture. Kết quả/ảnh chụp nằm ở `.data/navigation-check/`.",
  "",
  "Kiểm thử React bao gồm bookmark, tab, Back/Forward, hủy rời biểu mẫu chưa lưu, UAS ngày hiện tại và khóa ngữ cảnh bệnh nhân. Browser smoke xác minh landing theo 4 vai trò, luồng khám, upload–gắn ảnh, menu mobile và đăng nhập lại sau hết phiên. Chưa coi đây là E2E đầy đủ cho cả 67 API. Test database riêng bị bỏ qua khi không đặt `TEST_DATABASE_URL`.",
  "",
  "## Điểm vào của từng chức năng",
  "",
  "| Method | API | Luồng giao diện | Mã nguồn |",
  "|---|---|---|---|",
  ...operations.map(
    (o) =>
      `| ${o.method} | \`${o.path}\` | ${o.view} | ${o.sources.map((file) => `[${file}](../apps/web/src/${file})`).join(", ")} |`,
  ),
  "",
  "## API ngoài mẫu số 67",
  "",
  "`GET /data/schema` phục vụ metadata; `/data/:table` phục vụ bệnh án chuyên sâu, đơn thuốc đã lưu và danh sách tổn thương của nhân viên. `GET /image-attachments/:id/content` phục vụ preview ảnh có xác thực; `POST /ai/analyze` phục vụ AI. Health và alias tương thích không cần màn hình nghiệp vụ riêng. 25 API chưa hỗ trợ vẫn được liệt kê trong [API_SPEC_MAPPING.md](API_SPEC_MAPPING.md); giao diện không tạo nút thực thi cho các chức năng này.",
  "",
];
await writeFile(
  new URL("../docs/NAVIGATION_AND_API_COVERAGE.vi.md", import.meta.url),
  lines.join("\n"),
);
console.log(
  `UI mapping: ${operations.length}/${supported.length}; specification implemented: ${supported.length}/${endpoints.length}; unsupported: ${unsupported}`,
);
