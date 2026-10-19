# MayDay

Ứng dụng quản lý khám bệnh và theo dõi mề đay, triển khai từ [đặc tả MayDay](docs/MayDay.md) bằng React + TypeScript, NestJS, PostgreSQL, Prisma và Redis. Kho ảnh riêng sử dụng MinIO qua giao thức S3.

Web có giao diện cho bác sĩ, quản trị viên và bệnh nhân: quản lý bệnh án, phiếu khám động, đơn thuốc, xét nghiệm, tổn thương da, điểm UAS7 và thông báo. Đây là bản triển khai phục vụ phát triển và kiểm thử; các yêu cầu vận hành thực tế cần được đánh giá thêm theo [phạm vi triển khai](docs/IMPLEMENTATION.md).

## Chạy trên Windows PowerShell

Cài Node.js 24, npm và Docker Desktop với Linux containers. Chạy các lệnh sau tại thư mục gốc dự án. Cách này chạy PostgreSQL, Redis và MinIO trong Docker; API và web chạy bằng Node.js trên máy.

```powershell
npm ci

if (!(Test-Path -LiteralPath .env)) {
    Copy-Item -LiteralPath .env.example -Destination .env
}
```

Trong lần thiết lập đầu tiên, tạo khóa JWT riêng rồi cập nhật `.env`:

```powershell
$maydayJwtSecret = node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
(Get-Content -LiteralPath .env -Raw) -replace '(?m)^JWT_SECRET=.*$', "JWT_SECRET=$maydayJwtSecret" |
    Set-Content -LiteralPath .env -Encoding utf8
```

Khởi động hạ tầng, tạo Prisma Client, áp dụng migrations và nạp dữ liệu minh họa:

```powershell
npm run infra:up
docker compose ps
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Chờ PostgreSQL và Redis ở trạng thái `healthy` trước khi chạy migrations. MinIO được build từ mã nguồn bằng [infra/minio.Dockerfile](infra/minio.Dockerfile); lần chạy đầu cần Internet và có thể mất vài phút. API tạo bucket riêng khi kết nối được MinIO.

Giữ terminal `npm run dev` mở. Script chạy web qua Vite, đồng thời biên dịch và theo dõi thay đổi API. Dữ liệu demo chỉ được nạp khi có `SEED_DEMO_PASSWORD` trong `.env`; chạy lại seed giữ các tài khoản và bệnh án đã tồn tại, đồng thời khôi phục các quyền và thiết lập phân loại mẫu demo.

## Địa chỉ và tài khoản demo

| Dịch vụ | Địa chỉ mặc định |
| --- | --- |
| Web | http://localhost:5173 |
| API | http://localhost:3000/api/v1 |
| Swagger, khi không chạy production | http://localhost:3000/api/docs |
| Kiểm tra PostgreSQL và Redis | http://localhost:3000/api/v1/health |
| MinIO Console | http://localhost:59001 |
| PostgreSQL | localhost:55432 |
| Redis | localhost:56379 |
| MinIO S3 | localhost:59000 |

Mật khẩu demo mặc định trong `.env.example` là `MayDayDemo2026!`. Nếu đã đổi `SEED_DEMO_PASSWORD` trước lần seed đầu tiên, dùng giá trị mới của bạn.

| Vai trò | Số điện thoại | Email |
| --- | --- | --- |
| Quản trị viên | `0900000001` | `admin@mayday.local` |
| Bác sĩ | `0900000002` | `doctor@mayday.local` |
| Bệnh nhân | `0900000003` | `patient@mayday.local` |

Thông tin MinIO Console lấy từ `MINIO_ACCESS_KEY` và `MINIO_SECRET_KEY` trong `.env`. Các mật khẩu mẫu chỉ dành cho môi trường phát triển.

Seed gồm ba tài khoản, một cơ sở/khoa/phòng, phiếu sàng lọc phân loại, ba mẫu phiếu lâm sàng, bệnh án ở các trạng thái khác nhau, bảy ngày điểm UAS7, đơn thuốc và xét nghiệm minh họa, một đợt tổn thương và thông báo. Dữ liệu thuốc và xét nghiệm là dữ liệu kiểm thử.

## Các lệnh thường dùng

```powershell
npm run typecheck
npm test
npm run build
npm run test:integration
npm run db:studio
npm run infra:down
```

`test:integration` chạy [scripts/smoke.mjs](scripts/smoke.mjs) với API và hạ tầng đang hoạt động cùng dữ liệu demo đã seed. Script tạo các đối tượng kiểm thử và dọn chúng sau khi chạy; chỉ dùng cơ sở dữ liệu phát triển. Có thể đặt `SMOKE_API_URL` nếu API nằm ở địa chỉ khác. `infra:down` dừng containers và giữ các Docker volumes.

Trên Windows, nếu `db:generate` báo lỗi `EPERM` với `query_engine-windows.dll.node`, dừng API đang chạy, tạo lại Prisma Client rồi khởi động API. Tiến trình API có thể đang giữ DLL của Prisma.

## Cấu trúc và cấu hình

```text
apps/web/             React + TypeScript, Vite
apps/api/src/         Các module NestJS
apps/api/prisma/      Schema, migrations và seed
scripts/smoke.mjs     Kiểm thử tích hợp HTTP và dữ liệu
infra/                MinIO Dockerfile và cấu hình Nginx
docs/MayDay.md        Đặc tả nguồn
docs/IMPLEMENTATION.md Phạm vi và chi tiết triển khai
```

Frontend gọi `/api/v1` qua Vite proxy mặc định tới `http://localhost:3000`. Có thể đặt `API_PROXY_TARGET` trong `apps/web/.env` khi đổi máy chủ API; `VITE_API_URL` là địa chỉ gốc API được dùng khi build frontend cho một origin khác. `WEB_ORIGIN` trong `.env` kiểm soát CORS của backend.

Các biến tích hợp tùy chọn:

| Biến | Mục đích |
| --- | --- |
| `OTP_DELIVERY_URL`, `OTP_DELIVERY_TOKEN` | Webhook chuyển mã khôi phục mật khẩu qua nhà cung cấp SMS/OTP |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | File JSON service account để backend gửi FCM |
| `AI_SERVICE_URL` | Dịch vụ AI riêng có endpoint `POST /predict` |

Khi chưa cấu hình OTP hoặc AI, API tương ứng trả lỗi dịch vụ `503`. Thông báo vẫn được lưu trong PostgreSQL khi chưa có Firebase. Web hiện chưa tự đăng ký Firebase token hoặc service worker để nhận push; API đăng ký thiết bị sẵn sàng cho client tích hợp sau.

Dockerfile cho API/web và Compose profile `app` đã được build và kiểm tra trên máy phát triển. Sau khi thiết lập `.env`, migrations và seed như trên, có thể chạy toàn ứng dụng trong Docker:

```powershell
# Dừng npm run dev trước để giải phóng cổng API 3000.
docker compose --profile app up -d --build
```

Web qua Nginx ở `http://localhost:8080`; API vẫn ở cổng `3000`. API container tự áp dụng migrations khi khởi động. Cấu hình `.env.example` dùng chế độ phát triển; môi trường production cần secrets và cấu hình riêng.

Trước khi vận hành với dữ liệu thật, cần cấu hình HTTPS, khóa/mật khẩu riêng, sao lưu và khôi phục PostgreSQL/MinIO, giám sát và quy trình quản lý dữ liệu y tế. Chế độ `production` từ chối khóa JWT mẫu và biến `SEED_DEMO_PASSWORD`. Các mục tiêu độ trễ, AI 3–5 giây và uptime 99,9% trong tài liệu chưa được đo hoặc chứng nhận.
