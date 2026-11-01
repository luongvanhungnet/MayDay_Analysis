# MayDay

Ứng dụng quản lý hồ sơ khám và theo dõi mày đay, kèm phân tích ảnh AI thử nghiệm chạy local. Dự án dùng React 19 + Vite 6, NestJS 11 + Prisma 6 và PostgreSQL 17, sử dụng nguyên trạng 44 bảng trong mayday_backup.sql. Schema, dữ liệu, trigger, CHECK, khóa ngoại và các cột GENERATED của database là nguồn chuẩn. Ứng dụng không tạo bảng phụ, không chạy migrations và không seed tài khoản demo.

## Yêu cầu

- Node.js >= 22.12.0 và npm hỗ trợ workspaces.
- PostgreSQL 17 với database đã khôi phục từ `mayday_backup.sql`; file SQL không nằm trong repository.
- Tài khoản đăng nhập có sẵn trong database. Không có tài khoản demo tự tạo.
- Python 3.11 và ba checkpoint chỉ cần khi sử dụng phân tích ảnh AI.

## Chạy local

Thực hiện từ thư mục gốc dự án. Nếu chưa có `.env`, sao chép cấu hình mẫu:

```powershell
Copy-Item .env.example .env
```

Sửa `DATABASE_URL` trong `.env` theo database đã restore và thông tin PostgreSQL của máy. Nếu `.env` đã được cấu hình, giữ lại thông tin hiện có. Sau đó chạy:

```powershell
npm install
npm run db:generate
npm run dev
```

| Dịch vụ | Địa chỉ mặc định |
|---|---|
| Web | http://localhost:5173 |
| API | http://localhost:3000/api/v1 |
| Health | http://localhost:3000/api/v1/health |
| Swagger (khi không chạy production) | http://localhost:3000/api/docs |

Vite chuyển tiếp `/api` tới API ở cổng 3000. `npm run dev` khởi chạy cả API và web.

### Cấu hình môi trường

| Biến | Ý nghĩa |
|---|---|
| `DATABASE_URL` | Bắt buộc; chuỗi kết nối tới database đã restore. |
| `PORT` | Cổng API, mặc định `3000`. |
| `WEB_ORIGIN` | Origin được CORS cho phép, mặc định `http://localhost:5173`; nhiều origin phân cách bằng dấu phẩy. |
| `SESSION_FILE` | Tệp lưu phiên; mặc định `.data/sessions.json` tại thư mục gốc. |
| `AI_PYTHON` | Đường dẫn interpreter inference tùy chọn; mặc định dùng `.data/ai-venv`. |
| `TEST_DATABASE_URL` | Chỉ dành cho database kiểm thử riêng có tên `mayday_test_*`. |
| `DOCKER_DATABASE_URL` | Chuỗi kết nối PostgreSQL cho API trong Docker. |

Khi đổi cổng API, đặt `API_PROXY_TARGET` trong môi trường Vite (ví dụ `apps/web/.env.local`) tương ứng, như `http://localhost:3001`.

Đăng nhập bằng ten_dang_nhap hoặc số điện thoại gắn với tài khoản trong database và mật khẩu hiện có. Nếu một số điện thoại có nhiều tài khoản, dùng tên đăng nhập. Mật khẩu demo của dự án cũ không áp dụng cho file backup. Không đặt lại mật khẩu của các tài khoản import.

## Phân tích ảnh bằng ba model local

Sau khi đăng nhập, chọn **Phân tích ảnh AI**. Mỗi ảnh được chạy đồng thời qua model
Body/Multiple/Single, model normal skin/urticaria và model wheal đếm thử nghiệm.
Cài Python inference và đặt đủ ba checkpoint trước khi sử dụng:

| Model đang phục vụ | Nhãn | Checkpoint local |
|---|---|---|
| `lesions` | Body / Multiple / Single | `.data/ml/yolov8n_20261028_164928/weights/best.pt` |
| `skin` | normal skin / urticaria | `.data/ml/v4_two_class_20261029/weights/best.pt` |
| `counting` | wheal | `.data/ml/counting_pilot_50/weights/best.pt` |

Checkpoint không nằm trong Git. API nhận JPEG/PNG/WebP tối đa 8 MiB và 16 triệu pixel qua `POST /api/v1/ai/analyze`, multipart field `image`, có Bearer session. Ba worker Python chạy song song trên CPU; mỗi tiến trình API chỉ xử lý một yêu cầu phân tích tại một thời điểm, timeout mỗi worker 120 giây. Nếu một worker lỗi, cả yêu cầu thất bại.

- [Cài môi trường inference](ml/PARALLEL_INFERENCE.vi.md) — hướng dẫn venv; phần mô tả hai model là phiên bản ban đầu.
- [Ba model và giới hạn số đếm](ml/THREE_MODEL_INFERENCE.vi.md)

Model đếm được train bằng 50 ảnh duyệt mặc định với nhãn xấp xỉ; số hiển thị không
phải số nốt đã xác nhận. Ảnh và kết quả chỉ xử lý local, không tự ghi vào database.

### Các thử nghiệm ML ngoài model web

Repository có pipeline chuẩn bị dữ liệu, rà nhãn, huấn luyện và so sánh mô hình. Các thử nghiệm 63 ảnh chưa thay checkpoint đang phục vụ trên web:

- [Thử nghiệm YOLO trên 63 ảnh chọn lọc](ml/QUALITY63_RESULTS.vi.md).
- [So sánh YOLO và model điểm tâm trên 63 ảnh](ml/COUNTING63_INSTANCE_COMPARISON.vi.md).
- [Hướng dẫn gán nhãn](ml/ANNOTATION_GUIDELINES.vi.md).
- [Trạng thái bộ ảnh chọn lọc](ml/QUALITY_DATASET_100_STATUS.vi.md).

Nhãn điểm tâm/box của lượt so sánh vẫn là nhãn làm việc chưa được xác nhận độc lập. Kết quả hiện tại chưa đạt mục tiêu đếm chính xác và không dùng để kết luận lâm sàng. Dataset, checkpoint và báo cáo local trong `.data/ml/` cần được cung cấp riêng khi chuyển máy.

## Cấu trúc dự án

```text
apps/web/          Giao diện React; App.tsx sử dụng NativeApp
apps/api/          API NestJS, xác thực phiên, dữ liệu lâm sàng và điều phối AI
apps/api/prisma/   Ánh xạ Prisma của database hiện có
ml/                Inference, chuẩn bị dữ liệu, huấn luyện và báo cáo thử nghiệm
docs/              Tài liệu, kết quả kiểm tra database và ảnh giao diện
scripts/           Snapshot schema, kiểm thử HTTP và bảo vệ database
infra/             Cấu hình Nginx và image MinIO
```

## Các màn hình

Menu bao gồm thông tin cá nhân/bệnh nhân, hồ sơ cấp/mạn, phiên khám, sinh tồn, tiền sử, kết quả cận lâm sàng/PROMs/nghiệm pháp, đơn thuốc và chi tiết thuốc, UAS/AAS, tổn thương da, tệp đính kèm, cơ sở và tài khoản/vai trò. Danh sách có phân trang, tìm kiếm và lọc theo mã liên kết; biểu mẫu dùng các cột và lựa chọn CHECK thực tế. Khóa ngoại có danh sách lựa chọn với tên người/thuốc/cơ sở.

Tạo hồ sơ, phiên khám hoặc kết quả cận lâm sàng CAP/MAN tự tạo hàng chi tiết tương ứng trong cùng transaction để đáp ứng khóa ngoại deferred. Sau đó nhập chi tiết ở màn hình cấp hoặc mạn. Không tạo thêm hàng chi tiết trùng khóa.

Tiếp nhận bệnh nhân tạo nguoi và benhnhan trong cùng transaction. Tạo tài khoản cho người đã tồn tại ở mục Tài khoản, chọn người và vai trò; mật khẩu được bcrypt trước khi lưu. Để cấp nhân viên, tạo bản ghi Nhân viên với cùng mã người và chi nhánh. Database không có quan hệ phân công nhân viên theo khoa/phòng như phiên bản cũ.

Điểm UAS ngày, các mã subtype và các giá trị GENERATED do PostgreSQL tính; API từ chối ghi trực tiếp. Mã bigint đi qua JSON dưới dạng chuỗi, giữ nguyên độ chính xác. Các trường bắt buộc/giá trị hợp lệ vẫn được database kiểm tra.

## Quyền truy cập và phiên đăng nhập

admin quản lý toàn bộ; bac_si đọc và cập nhật dữ liệu lâm sàng; dieu_duong đọc lâm sàng, cập nhật thông tin bệnh nhân và theo dõi; benh_nhan chỉ đọc dữ liệu của mình và ghi nhật ký/theo dõi của mình. Các danh mục cơ sở/thuốc/nghiệm pháp do admin quản lý. Vai trò lạ bị từ chối. Đây là chính sách trong code theo 4 vai trò của backup; bảng quyenhan/vaitroquyenhan hiện chưa có dữ liệu và không được tự seed hay chuyển thành quyền endpoint giả định.

Phiên đăng nhập có thời hạn 2 giờ, token ngẫu nhiên chỉ lưu bản băm ở .data/sessions.json. Đăng xuất thu hồi token; đổi mật khẩu/vai trò hoặc khóa tài khoản làm phiên cũ mất hiệu lực. SESSION_FILE có thể trỏ tới thư mục dữ liệu riêng. Cơ chế lưu phiên này dành cho một tiến trình API local; khi chạy nhiều instance cần bổ sung kho phiên dùng chung. Không cần Redis hoặc JWT_SECRET để chạy bản local này.

## Kiểm tra

```powershell
npm run typecheck
npm test
npm run build
# Chỉ chạy với database riêng có tên mayday_test_* đã restore từ backup:
$env:TEST_DATABASE_URL = 'postgresql://postgres:password@localhost:5432/mayday_test_native'
npm run build -w @mayday/api
npm run test:integration
```

Kiểm thử tích hợp có ghi dữ liệu giả và tuyệt đối không dùng database thật; script từ chối tên database không bắt đầu bằng mayday_test_. Kết quả HTTP được lưu trong docs/database-verification.json. Các test tích hợp Vitest được bỏ qua khi không có TEST_DATABASE_URL.

## Schema và khôi phục

apps/api/prisma/schema.prisma là ánh xạ ORM của database, không phải migration. apps/api/src/native/schema.json lưu metadata cột/khóa/CHECK/quan hệ, không chứa bản ghi người dùng. db:snapshot chỉ đọc metadata PostgreSQL qua psql. Không dùng prisma db push, migrate dev hoặc schema diff để thay đổi database này. db:migrate và db:seed được chặn có chủ đích để tránh tạo lại schema UUID cũ.

Để import sang một database mới khác, tạo database rỗng và role mayday_app (nếu chưa có) trước, rồi dùng psql --single-transaction -v ON_ERROR_STOP=1 -f với đường dẫn file SQL gốc. Role này là đích GRANT có sẵn trong dump. Không restore đè vào database đang chứa dữ liệu. File SQL gốc được giữ ngoài repository.

## Phạm vi

Phiên bản này dùng biểu mẫu theo schema lâm sàng cố định. Các bảng phiếu động, thông báo/FCM, blacklist token, email và kết quả AI của schema UUID cũ không tồn tại trong backup, nên các module phụ thuộc chúng được thay thế bằng luồng dữ liệu native. Mục Tệp đính kèm hiện quản lý metadata/đường dẫn có sẵn; không tự di chuyển file ảnh, tải file lên MinIO hoặc gọi AI. Các file ảnh ngoài database phải được giữ tại kho gốc.

## Docker

Để chạy API và web bằng Compose sau khi đã tạo `.env` và cấu hình `DOCKER_DATABASE_URL`:

```powershell
docker compose --profile app up -d --build api web
```

Web Docker: http://localhost:8080. Cấu hình `WEB_ORIGIN=http://localhost:8080` trong `.env` nếu truy cập API từ origin này. API vẫn được expose tại http://localhost:3000/api/v1.

Compose cũng có PostgreSQL (cổng host `55432`), Redis (`56379`) và MinIO (`59000`, console `59001`), khởi chạy bằng `npm run infra:up`. Luồng lâm sàng và lưu phiên hiện tại không yêu cầu Redis/MinIO. PostgreSQL trong Compose ban đầu là database rỗng, vẫn cần restore backup và cấu hình lại kết nối trước khi dùng.

Dockerfile không tự chạy migration. Nếu dùng Compose với database local trên Windows, đặt DOCKER_DATABASE_URL trỏ tới host.docker.internal thay cho localhost. Container không tự import SQL. Image API hiện không đóng gói Python, script ML hoặc checkpoint; hướng dẫn AI phía trên dành cho chạy local. Cấu hình Docker cần được kiểm tra trong môi trường triển khai thực tế.
