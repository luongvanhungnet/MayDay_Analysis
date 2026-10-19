# Phạm vi triển khai MayDay

Tài liệu này mô tả mã nguồn đã triển khai từ [MayDay.md](MayDay.md), cách các phân hệ kết nối và các giới hạn cần tiếp tục xử lý. Hướng dẫn khởi động và tài khoản demo nằm trong [README](../README.md).

## Kiến trúc

| Thành phần | Công nghệ và trách nhiệm |
| --- | --- |
| `apps/web` | React 19, TypeScript, React Router, Vite; giao diện tiếng Việt theo vai trò |
| `apps/api` | NestJS 11; xác thực, phân quyền, kiểm tra đầu vào và xử lý nghiệp vụ |
| PostgreSQL 17 | Dữ liệu tài khoản, cơ sở vật chất, phiếu khám và nghiệp vụ y tế |
| Prisma 6.19.3 | 32 models, migrations, truy vấn và giao dịch dữ liệu |
| Redis 7 | Cache cấu trúc phiếu khám, blacklist token và khóa gửi thông báo |
| MinIO | Kho ảnh riêng qua S3; backend kiểm tra quyền trước khi trả nội dung |
| Firebase / OTP / AI | Các adapter bên ngoài, cần cấu hình nhà cung cấp |

Prisma sử dụng tên trường `snake_case`, UUID cho các định danh và quan hệ subtype `Patient.user_id`/`Staff.user_id` trỏ đến `User.id`. Trong API, ID bệnh nhân tương ứng ID người dùng. Số 32 models phản ánh cả các bảng subtype, liên kết quyền tới endpoint và chi tiết xét nghiệm/thông báo; tài liệu nguồn có phần tổng quan ghi 29 bảng.

API có prefix `/api/v1`. Phản hồi JSON thông thường dùng `{ code, message, data }`; danh sách phân trang thêm `meta`. Mã thành công là `1000` hoặc `1001`. HTTP status vẫn thể hiện lỗi xác thực, từ chối quyền, xung đột và lỗi dịch vụ. Endpoint tải nội dung ảnh trả luồng binary sau khi kiểm tra quyền.

## Đối chiếu các phần trong đặc tả

| Phần MayDay.md | Module và hành vi đã triển khai | Các endpoint chính, sau `/api/v1` |
| --- | --- | --- |
| 1. Xác thực và tài khoản | Đăng ký bệnh nhân, đăng nhập điện thoại/email, profile, đổi/khôi phục mật khẩu, tạo nhân viên | `/auth/signup`, `/auth/login`, `/auth/logout`, `/auth/change-password`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/admin/create-staff`, `/profile` |
| 2. Quản trị và RBAC | CRUD tài khoản, phân công nhân viên, vai trò phân cấp, quyền, cấp/tước quyền và ánh xạ API | `/admin/users`, `/roles`, `/permissions`, `/role_permissions`, `/api-endpoints` |
| 3. Cơ sở vật chất | CRUD chi nhánh → khoa → phòng; kiểm tra quan hệ khi phân công | `/branches`, `/departments`, `/rooms` |
| 4. Bệnh nhân và bệnh án | Tìm/tạo bệnh nhân, khai báo phân loại, tạo/nhận/hoàn tất bệnh án, câu trả lời, lịch sử và tóm tắt | `/doctor/patients`, `/medical_records` |
| 5. UAS7 | Kiểm tra điều kiện ghi điểm, ghi một lần/ngày, lịch sử và tổng hợp cửa sổ bảy ngày | `/uas7-scores/eligibility`, `/uas7-scores`, `/uas7-scores/patient/:id` |
| 6. Đơn thuốc và xét nghiệm | Tạo đơn cùng các thuốc, yêu cầu cùng các xét nghiệm, nhập và xem kết quả | `/prescriptions`, `/lab-requests`, `/lab-results` |
| 7. Media và ảnh câu trả lời | Upload tối đa 10 ảnh/lần, gắn/gỡ ảnh, danh sách và tải nội dung riêng | `/image-attachments`, `/answer-images` |
| 8. Tổn thương | Đợt tổn thương, vị trí, ảnh và mốc `start`/`peak`/`normal`, các điểm triệu chứng | `/lesion-episodes`, `/lesion-locations`, `/lesion-photos` |
| 9. Thông báo | Lưu thông báo, đánh dấu đọc/xóa, cấu hình người dùng, đăng ký FCM token, gửi khi có provider và nhắc hằng ngày | `/notifications`, `/notifications/settings` |
| 10. Phiếu khám động | Template → Section → Question → Option; điều kiện câu hỏi, thứ tự, người điền và quản lý cấu trúc | `/templates`, `/templates/sections/:id`, `/templates/questions/:id` |

Web có các màn hình tổng quan, bệnh nhân, bệnh án/chi tiết bệnh án, theo dõi UAS7/tổn thương, phiếu khám, cơ sở vật chất, quản trị, thông báo và tài khoản. Đặc tả định hướng web dành cho bác sĩ và client di động cho bệnh nhân/bác sĩ. Bản triển khai này cho phép cả bác sĩ, admin và bệnh nhân sử dụng web theo quyền của mình; ứng dụng mobile/native riêng cho lớp IT4788 chưa được thực hiện trong kho mã nguồn này.

## Quy tắc nghiệp vụ và bảo vệ dữ liệu

### Xác thực và phân quyền

Mật khẩu được băm bằng bcrypt. JWT có thời hạn cấu hình qua `JWT_EXPIRES_IN`; giá trị hợp lệ là số giây hoặc dạng `1h`, từ 60 giây đến một ngày. Backend kiểm tra tài khoản hoạt động và `token_version` với mỗi phiên.

Đăng xuất ghi hash access token vào bảng `token_blacklist` và Redis. Đổi mật khẩu blacklist token hiện tại và tăng `token_version`, làm các token cũ trên những thiết bị khác mất hiệu lực. Đặt lại mật khẩu cũng tăng phiên bản token. Hash mật khẩu, reset token và các trường nội bộ không xuất hiện trong profile hoặc danh sách tài khoản.

`RolePermission` và `PermissionEndpoint` quyết định quyền gọi API. Khi khởi động, hệ thống đăng ký các endpoint có decorator quyền nếu chưa tồn tại; ánh xạ đã được quản trị viên thay đổi được giữ lại. Phân quyền endpoint kết hợp với kiểm tra dữ liệu: bệnh nhân chỉ đọc dữ liệu của mình, nhân viên chỉ đọc bệnh án được phân công; admin có quyền quản trị rộng hơn. Danh sách bệnh án chờ và tìm kiếm thông tin bệnh nhân phục vụ quy trình tiếp nhận vẫn là các chức năng riêng của nhân viên có quyền.

DTO dùng Zod và các trường hợp cập nhật profile/tài khoản nhạy cảm dùng schema strict. Thay đổi profile cá nhân không thể đổi vai trò hoặc trạng thái tài khoản. Đăng nhập, đăng ký và khôi phục mật khẩu có giới hạn 10 lần cho mỗi IP/route trong 10 phút ở từng tiến trình API; giới hạn này chưa phải cơ chế phân tán cho nhiều replica.

### Bệnh án

Luồng nghiệp vụ chính là `pending` → `in_progress` → `completed`. Tiếp nhận sử dụng cập nhật có điều kiện để hai bác sĩ không cùng nhận một bệnh án. Bác sĩ chỉ hoàn tất bệnh án đang xử lý và được phân công cho mình.

Các thao tác ghi dữ liệu con khóa hàng bệnh án trong giao dịch. Sau khi hoàn tất, API từ chối các thao tác bổ sung hoặc sửa dữ liệu lâm sàng qua các luồng thông thường. Câu trả lời có ràng buộc duy nhất theo `(medical_record_id, question_id)`. Câu hỏi phải thuộc đúng mẫu phiếu; option phải thuộc đúng câu hỏi. Backend kiểm tra loại dữ liệu, trường bắt buộc, điều kiện câu hỏi và `filled_by` của section.

API xóa bệnh án dành cho admin có thể xóa cùng các đơn thuốc, xét nghiệm và đợt tổn thương liên quan. Đây là thao tác xóa dữ liệu, chưa có hệ thống audit log, lưu trữ pháp lý hoặc chức năng phục hồi trong giao diện. Xóa bệnh nhân có dữ liệu theo dõi hoặc xóa người dùng sở hữu media bị chặn để giữ dữ liệu; có thể vô hiệu hóa tài khoản thay thế.

### Phiếu khám và phân loại

Các loại câu hỏi hiện có: `text`, `number`, `date`, `radio`, `checkbox`, `image_upload`. Quan hệ câu hỏi cha/con, `show_if_answer` và `condition_rules` cho phép hiện câu hỏi theo đáp án; các toán tử là `equals`, `contains`, `not_equals`. Backend chặn cây câu hỏi có vòng lặp và trùng giá trị option.

Mẫu đã tạo bệnh án được bảo vệ khỏi sửa/xóa cấu trúc câu hỏi và section; tạo một phiên bản mới để thay đổi cấu trúc. Cache server cho chi tiết template dùng Redis với TTL 60 giây và được xóa sau khi cập nhật qua API. Web hiện chưa có offline cache hoặc hàng đợi gửi dữ liệu khi mất mạng như yêu cầu mobile trong tài liệu nguồn.

Phân loại truy vấn các mẫu đang hoạt động trong database. Template có `kind` là `classification` chứa câu hỏi sàng lọc; template `clinical` có `classification_rules` dạng:

```json
{
  "priority": 10,
  "conditions": [
    { "question_id": "30000000-0000-4000-8000-000000000023", "value": "yes" }
  ]
}
```

API yêu cầu đáp án hợp lệ cho các câu hỏi sàng lọc. Một mẫu khớp khi toàn bộ điều kiện đúng; mẫu có độ ưu tiên lớn nhất được chọn, nếu bằng nhau sắp theo ID. Seed thiết lập tái khám ưu tiên 20, mề đay mạn tính ưu tiên 10 và cấp tính ưu tiên 0. Các rules là cấu hình mẫu demo phục vụ quy trình phần mềm, cần bác sĩ xác định lại để sử dụng trong chuyên môn.

Câu hỏi sàng lọc dùng loại `radio` và không có câu hỏi cha. Khi cấu hình rule, API kiểm tra question và giá trị option thuộc bộ sàng lọc đang hoạt động. Khi thay đổi bộ sàng lọc, cần cập nhật các rule tương ứng trước khi đưa cấu hình mới vào sử dụng.

### UAS7 và tổn thương

`iss7` và `hss7` trong khoảng 0–3; `daily_score` là tổng trong ngày. PostgreSQL kiểm tra khoảng điểm, tổng điểm và unique `(patient_id, score_date)`. API chặn ngày tương lai và yêu cầu bệnh nhân có bệnh án `pending` hoặc `in_progress` phù hợp.

Lịch sử tổng hợp theo cửa sổ bảy ngày liên tiếp. Tổng `uas7` chỉ được trả như tổng tuần khi đủ bảy ngày; nếu thiếu ngày, có các tổng thành phần cùng `complete: false` và `uas7: null`. Ngày lâm sàng và nhắc hằng ngày sử dụng múi giờ `Asia/Bangkok`.

Tổn thương được tổ chức thành episode → location → photo. Ảnh có mốc khởi phát/đỉnh điểm/hồi phục, điểm ngứa/đau/rát 0–10, số sẩn phù và kết quả AI khi có tích hợp. Điểm ngứa trên ảnh là thang riêng với điểm ngứa UAS7 0–3.

### Ảnh và kho lưu trữ

Upload dùng `multipart/form-data` với field `files`, tối đa 10 ảnh, mỗi ảnh tối đa 5 MB. Nội dung phải có định dạng JPEG, PNG hoặc WebP hợp lệ theo kiểm tra magic bytes; tên file/MIME client cung cấp không đủ để được chấp nhận. Mã hiện tại chưa có pipeline quét malware hoặc giải mã/re-encode ảnh đầy đủ.

MinIO không được mở bucket công khai. Metadata chứa đường dẫn API được bảo vệ; backend tải object sau kiểm tra quyền trên người upload hoặc bệnh án liên quan. Upload thất bại sẽ dọn các object đã tạo trong lần upload đó. Ảnh đang gắn với câu trả lời, tổn thương hoặc xét nghiệm không được xóa trực tiếp.

### Thông báo và nhắc hằng ngày

Thông báo về thao tác khám, đơn thuốc và kết quả xét nghiệm được lưu vào database, sau đó gửi FCM khi được cấu hình. Job trong tiến trình API chạy mỗi 30 giây: thử lại thông báo `pending` và tạo nhắc UAS7/nhắc theo dõi điều trị theo `reminder_time`. ID nhắc hằng ngày được xác định từ người dùng, ngày và loại để chặn trùng dữ liệu; gửi thông báo dùng khóa Redis.

Nhắc thuốc hiện là lời nhắc chung theo cài đặt người dùng khi có đơn thuốc ở bệnh án đang xử lý, chưa phân tích lịch dùng từng liều từ trường `frequency`/`duration`. Cấu hình `appointment_enabled` được lưu nhưng chưa có phân hệ đặt lịch khám, lịch hẹn lâm sàng hoặc job nhắc tái khám tự động. Sound/push preferences được lưu; âm thanh trên thiết bị phụ thuộc client/provider.

Web hiển thị feed thông báo đã lưu. API `POST /notifications` đăng ký FCM token với các trường `fcm_token`, `platform`, `device_id`; đây không phải API gửi thông báo tùy ý. Web hiện chưa có Firebase SDK/service worker để tự nhận token và hiển thị push ở trình duyệt.

## Hợp đồng với dịch vụ bên ngoài

### OTP

Đặt `OTP_DELIVERY_URL`; có thể đặt `OTP_DELIVERY_TOKEN` để gửi header `Authorization: Bearer ...`. Backend gọi webhook bằng JSON:

```json
{ "phone": "0900000003", "code": "123456", "expires_in": 600 }
```

Webhook cần phản hồi HTTP thành công sau khi chấp nhận chuyển mã. Backend đặt timeout 5 giây, lưu hash mã cùng thời hạn 10 phút và không trả mã OTP trong API. `POST /auth/reset-password` nhận `phone`, `token`, `newPassword`, `confirm_password`. Chưa cấu hình webhook hoặc provider lỗi thì khôi phục trả `503`. Việc gửi SMS thực tế chưa được kiểm thử tích hợp với nhà cung cấp.

### Firebase Cloud Messaging

`FIREBASE_SERVICE_ACCOUNT_PATH` trỏ tới JSON service account trên máy chạy API. Client cần cung cấp token thông qua API đăng ký thiết bị. Backend xử lý thiết bị không còn hợp lệ, cấu hình tắt thông báo và retry lỗi tạm thời cho các hàng `pending`. Nếu provider chưa cấu hình, thông báo có thể được lưu với trạng thái `provider_not_configured`; thông báo cũ ở trạng thái đó không tự chuyển sang `pending` chỉ vì thêm cấu hình.

Việc lưu thông báo đã được đưa vào kiểm thử tích hợp nội bộ. Gửi FCM thật, nhận push trên trình duyệt/mobile và xử lý đa thiết bị chưa được kiểm thử với credentials thực.

### AI phân tích ảnh

`AI_SERVICE_URL` trỏ tới service riêng; backend gọi `POST <AI_SERVICE_URL>/predict`, multipart field `image`. Dịch vụ trả JSON:

```json
{ "hives_count": 12, "local_auas": 2.5, "confidence": 0.9 }
```

`hives_count` là số nguyên không âm; `local_auas` và `confidence` là tùy chọn. Endpoint MayDay là `POST /lesion-photos/:id/predict`, có kiểm tra quyền ghi bệnh án và lưu kết quả vào ảnh. Timeout provider là 5 giây; lỗi/không cấu hình trả `503`. Không có mô hình AI được xây dựng hoặc đánh giá trong dự án này, và adapter chưa được thử với một AI service thực.

## Kiểm thử và giới hạn vận hành

Các lệnh kiểm tra:

```powershell
npm run typecheck
npm test
npm run build
npm run test:integration
```

Unit tests tập trung vào quyền truy cập, chuyển trạng thái bệnh án, tổng tuần UAS7, điều kiện và phân loại template, kiểm tra ảnh, validation, giới hạn xác thực, blacklist và phiên frontend. `scripts/smoke.mjs` gọi HTTP tới API đang chạy với PostgreSQL, Redis và MinIO của môi trường phát triển; kiểm tra các luồng xác thực, phân quyền, bệnh án, ảnh, UAS7, đơn thuốc, xét nghiệm và thông báo, rồi dọn các fixture do script tạo. Nó không gửi OTP/FCM hoặc gọi AI provider thật.

Các kiểm tra này là kiểm tra chức năng, không phải chứng nhận y tế hoặc kiểm thử tải. Chưa xác nhận mục tiêu API dưới 500 ms, xử lý AI 3–5 giây, uptime 99,9%, HA/failover, backup restore, quan sát hệ thống và tải đồng thời ở quy mô bệnh viện. Pagination và giới hạn danh sách hiện có nhưng chưa thay thế kiểm thử dữ liệu lớn.

Kết quả xác minh ngày 09/10/2026: 32 kiểm thử tự động đạt (25 API, 7 web), TypeScript và production build đạt, `npm audit` báo 0 lỗ hổng. Cả hai Docker images build thành công; ứng dụng qua Nginx ở cổng 8080 đạt 62 kiểm tra HTTP tích hợp với PostgreSQL, Redis và MinIO. Đã kiểm tra trực tiếp đăng nhập/dashboard, bệnh án/đơn thuốc, UAS7, trình chỉnh quy tắc phân loại và bố cục màn hình nhỏ trong trình duyệt. [Ảnh dashboard](screenshots/mayday-dashboard.png) lưu cùng tài liệu.

Compose mặc định phục vụ phát triển trên máy: các cổng database/storage bind localhost, volumes giữ dữ liệu. API/Vite ở chế độ phát triển có thể bind `0.0.0.0`; cần cân nhắc mạng khi chia sẻ máy. Redis AOF và Docker volumes không thay thế quy trình backup PostgreSQL/MinIO.

Trước khi dùng production cần HTTPS/reverse proxy, secrets riêng và quản lý vòng đời khóa, giới hạn upload/request phù hợp, logging/audit dữ liệu y tế, backup/restore, monitoring, quyền vận hành database/storage và đánh giá chính sách lưu/xóa dữ liệu. `NODE_ENV=production` chặn JWT placeholder và `SEED_DEMO_PASSWORD`; Swagger chỉ mở khi không phải production. Cấu hình CORS không thay thế kiểm soát truy cập bằng JWT/RBAC.
