# MayDay

Ứng dụng React + NestJS + PostgreSQL 17, sử dụng nguyên trạng 44 bảng trong mayday_backup.sql. Schema, dữ liệu, trigger, CHECK, khóa ngoại và các cột GENERATED của database là nguồn chuẩn. Ứng dụng không tạo bảng phụ, không chạy migrations và không seed tài khoản demo.

## Chạy với PostgreSQL local

Database mayday đã được import từ file người dùng cung cấp. Giữ DATABASE_URL đã cấu hình trong .env.

```powershell
npm install
npm run db:generate
npm run dev
```

Web: http://localhost:5173 · API: http://localhost:3000/api/v1 · Health: http://localhost:3000/api/v1/health

Đăng nhập bằng ten_dang_nhap hoặc số điện thoại gắn với tài khoản trong database và mật khẩu hiện có. Nếu một số điện thoại có nhiều tài khoản, dùng tên đăng nhập. Mật khẩu demo của dự án cũ không áp dụng cho file backup. Không đặt lại mật khẩu của các tài khoản import.

## Phân tích ảnh bằng ba model local

Sau khi đăng nhập, chọn **Phân tích ảnh AI**. Mỗi ảnh được chạy đồng thời qua model
Body/Multiple/Single, model normal skin/urticaria và model wheal đếm thử nghiệm.
Cài Python inference và đặt đủ ba checkpoint trước khi sử dụng:

- [Cài môi trường inference](ml/PARALLEL_INFERENCE.vi.md)
- [Ba model và giới hạn số đếm](ml/THREE_MODEL_INFERENCE.vi.md)

Model đếm được train bằng 50 ảnh duyệt mặc định với nhãn xấp xỉ; số hiển thị không
phải số nốt đã xác nhận. Ảnh và kết quả chỉ xử lý local, không tự ghi vào database.

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
npm run test:integration
```

Kiểm thử tích hợp có ghi dữ liệu giả và tuyệt đối không dùng database thật; script từ chối tên database không bắt đầu bằng mayday_test_. Kết quả HTTP được lưu trong docs/database-verification.json. Các test tích hợp Vitest được bỏ qua khi không có TEST_DATABASE_URL.

## Schema và khôi phục

apps/api/prisma/schema.prisma là ánh xạ ORM của database, không phải migration. apps/api/src/native/schema.json lưu metadata cột/khóa/CHECK/quan hệ, không chứa bản ghi người dùng. db:snapshot chỉ đọc metadata PostgreSQL qua psql. Không dùng prisma db push, migrate dev hoặc schema diff để thay đổi database này. db:migrate và db:seed được chặn có chủ đích để tránh tạo lại schema UUID cũ.

Để import sang một database mới khác, tạo database rỗng và role mayday_app (nếu chưa có) trước, rồi dùng psql --single-transaction -v ON_ERROR_STOP=1 -f với đường dẫn file SQL gốc. Role này là đích GRANT có sẵn trong dump. Không restore đè vào database đang chứa dữ liệu. File SQL gốc được giữ ngoài repository.

## Phạm vi

Phiên bản này dùng biểu mẫu theo schema lâm sàng cố định. Các bảng phiếu động, thông báo/FCM, blacklist token, email và kết quả AI của schema UUID cũ không tồn tại trong backup, nên các module phụ thuộc chúng được thay thế bằng luồng dữ liệu native. Mục Tệp đính kèm hiện quản lý metadata/đường dẫn có sẵn; không tự di chuyển file ảnh, tải file lên MinIO hoặc gọi AI. Các file ảnh ngoài database phải được giữ tại kho gốc.

Dockerfile không tự chạy migration. Nếu dùng Compose với database local trên Windows, đặt DOCKER_DATABASE_URL trỏ tới host.docker.internal thay cho localhost. Container không tự import SQL. Docker chưa được chạy kiểm thử trong phiên làm việc này.
