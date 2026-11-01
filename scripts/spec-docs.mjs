import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {endpoints}=require('../apps/api/dist/spec/catalog.js');
const {resources}=require('../apps/api/dist/spec/resources.js');
const intro=`# API đặc tả — ánh xạ vào database hiện tại

Phạm vi: 92 chức năng được mô tả riêng trong docs/MayDay.md (gộp input/output của cùng chức năng). Giữ nguyên 44 bảng, CHECK, FK, trigger và GENERATED; không migration, seed hoặc ghi vào database người dùng khi chạy kiểm thử.

**67 chức năng có xử lý dữ liệu; 25 chức năng chưa hỗ trợ do giới hạn schema/chính sách lưu hồ sơ.** Đăng ký route hoặc trả 501 không có nghĩa đã hoàn tất chức năng. Các API ánh xạ là phiên bản thích nghi với schema hiện tại, không cam kết tương thích hoàn toàn DTO của schema cũ.

## Cách gọi

- Tiền tố: /api/v1. Swagger: /api/docs khi không chạy production; JSON: /api/docs-json.
- Tất cả API riêng tư dùng Authorization: Bearer <session token>; giữ phiên NativeService hiện có, không đổi sang JWT.
- Bigint trả dưới dạng chuỗi. API đặc tả dùng ID đơn trong đường dẫn; /data vẫn dùng khóa JSON như trước.
- Envelope giữ nguyên {code,message,data}; danh sách có thể kèm meta (page, limit, total, total_pages).
- POST tạo trả 201, login/logout trả 200; đổi mật khẩu PUT trả 200. Lỗi 400/401/403/404/409; thiếu khả năng lưu trữ trả HTTP 501, code 5010, data null.
- Vai trò đang áp dụng: admin, bac_si, dieu_duong, benh_nhan. CRUD quyền lưu dữ liệu vaitroquyenhan nhưng không biến chính sách vai trò hiện có thành RBAC động theo endpoint; schema không có bảng permissions_endpoints. Vai trò tùy chỉnh chưa có chính sách lâm sàng sẽ bị từ chối.
- Danh mục cơ sở đọc theo quyền NativeService, chỉ admin sửa/xóa; quản trị tài khoản/vai trò/quyền chỉ admin. Bệnh nhân chỉ đọc dữ liệu của mình. Tiếp nhận/chốt/kê đơn yêu cầu bác sĩ; chốt/kê đơn phải là người phụ trách phiên khám mới nhất.

## Khác biệt cần biết

- Mật khẩu mới giữ quy tắc dự án: tối thiểu 10 ký tự, tối đa 72 byte (khác yêu cầu 6 ký tự trong hình đặc tả cũ).
- Giới tính lưu Nam/Nu; nhận thêm male/female; other không có giá trị CHECK tương ứng nên bị từ chối. Nghề nghiệp và các lựa chọn khác tuân theo CHECK của schema; GET /data/schema cung cấp danh sách.
- signup tự chọn vai trò benh_nhan; không nhận role_id/is_active. username tùy chọn, mặc định phone. Đăng ký tạo nguoi, benhnhan/nhanvien và taikhoan trong cùng transaction.
- Nhân viên cần branch_id. Không có phân công khoa/phòng trên nhanvien. Vai trò không có parent_role_id; display_name mặc định bằng name.
- Xóa user khóa taikhoan, giữ nguoi và dữ liệu lâm sàng; phiên cũ tự mất hiệu lực. Xóa bệnh án trả 501 để giữ lịch sử. Xóa danh mục/tổn thương giữ các ràng buộc FK; không tự cascade hoặc xóa dữ liệu con.
- Hồ sơ mới dùng patient_id, record_type CAP/MAN và trạng thái pending. Bệnh nhân bị cố định patient_id của chính mình. /accept tạo phienkham cùng subtype trong transaction, lưu bác sĩ tại ma_bac_si và chuyển in_progress. Hai yêu cầu tiếp nhận đồng thời chỉ một thành công. Chốt PUT chỉ nhận instructions, lưu vào dan_do của phiên khám, chuyển completed. Không có completed_at của schema cũ.
- /doctor/patients tạo nguoi + benhnhan, không tự cấp tài khoản; cần tài khoản dùng signup hoặc admin/users. Bộ câu hỏi phân loại, template và answers động không tồn tại; không suy đoán quy tắc phân loại hoặc nhét JSON vào cột lâm sàng.
- UAS dùng nhật ký ngày của bệnh án MAN; điểm HSS/ISS nguyên 0–3, điểm tổng do PostgreSQL tính. Chỉ bệnh nhân ghi ngày hiện tại theo Asia/Bangkok; chống trùng theo bệnh nhân/ngày trong transaction. cycle_id tùy chọn nhưng phải thuộc bệnh nhân và đúng ngày trong chu kỳ. Trạng thái pending/in_progress/completed được coi là bệnh án mạn hợp lệ; draft/cancelled không hợp lệ. Không tái tạo thuật toán UAS7 khác ngoài schema.
- Upload multipart field image (JPEG/PNG/WebP, tối đa 8 MiB) và medical_record_id. File được kiểm tra signature, đặt tên UUID, lưu private local tại UPLOAD_DIR hoặc .data/uploads; metadata tepdinhkem. Không cài thêm MinIO/S3. Không trả đường dẫn filesystem.
- Route hỗ trợ thêm GET /image-attachments/:id/content: Bearer + kiểm tra quyền bệnh án; không public static, Cache-Control private/no-store. Tệp import từ kho cũ chưa có bộ đọc tương ứng trả 501. Xóa tệp đang được tham chiếu trả 409. Nếu xóa nội dung local thất bại sau xóa metadata, trả storage_cleanup_pending: true.
- Tạo ảnh tiến triển cần attachment_id, episode_id hoặc location_id, taken_at; ảnh và đợt tổn thương phải cùng bệnh nhân/bệnh án. milestone chỉ start/peak/normal như test case trong đặc tả.
- Sửa lỗi copy tại lphoto02: GET /lesion-photos/location/:location_id, thay đường dẫn loc03 bị chép lặp trong tài liệu.
- Bảng role_permissions dùng khóa ghép role_id + permission_id; không có role_permission_id. Không tạo cột thời gian hoặc trường mô tả chưa có trong schema; các trường không có ánh xạ sẽ báo lỗi.

## Payload tiêu biểu

| Thao tác | Body |
|---|---|
| signup | {"full_name":"Tên bệnh nhân","phone":"0123456789","password":"MatKhauDuDai2026!","gender":"female"} |
| login | {"phone":"0123456789","password":"MatKhauDuDai2026!"} — hoặc identifier/username |
| đổi mật khẩu | {"old_password":"...","new_password":"..."} |
| profile PUT | {"full_name":"Tên mới","occupation":"Khac"} |
| tạo nhân viên | {"full_name":"Tên bác sĩ","phone":"0123456788","password":"MatKhauDuDai2026!","role_id":"2","branch_id":"1"} — ID lấy từ database, không hard-code |
| tạo bệnh nhân tiếp nhận | {"person":{"full_name":"Tên bệnh nhân","phone":"0123456787"},"patient":{"occupation":"Khac"}} |
| cấp quyền | {"role_id":"2","permission_ids":["1","2"]} |
| tạo hồ sơ | {"patient_id":"10","record_type":"MAN"} — bệnh nhân có thể bỏ patient_id |
| chốt hồ sơ | {"instructions":"Dặn dò của bác sĩ"} |
| nhật ký UAS | {"medical_record_id":"10","hss_score":2,"iss_score":1} |
| kê đơn | {"medical_record_id":"10","notes":"...","medicines":[{"name":"Tên thuốc","dosage":"...","duration":"..."}]} — có thể dùng medicine_id từ danh mục |
| tạo đợt tổn thương | {"medical_record_id":"10","name":"Đợt 1"} |
| tạo vị trí | {"episode_id":"1","body_location":"Cánh tay"} |
| tạo ảnh tiến triển | {"attachment_id":"1","location_id":"1","taken_at":"2026-11-01T10:00:00+07:00","milestone":"start"} |

## Danh sách đủ 92 chức năng

Các đường dẫn là hợp đồng thích nghi của lớp SpecController. “Ánh xạ” có nghĩa có handler thật; xem cột giới hạn và các khác biệt phía trên.

| STT | Mục trong đặc tả | Method | Đường dẫn | Trạng thái | Bảng / giới hạn |
|---:|---|---|---|---|---|
`;
const rows=endpoints.map((e,i)=>`| ${i+1} | ${e.source} | ${e.method} | /api/v1/${e.path} | ${e.action==='unsupported'?'Chưa hỗ trợ (501)':'Ánh xạ'} | ${[e.resource?resources[e.resource]?.table:undefined,e.limitation].filter(Boolean).join('; ')||'Xử lý nghiệp vụ chuyên biệt'} |`).join('\n');
const fields='\n\n## Ánh xạ trường của các tài nguyên\n\nNhận các alias dưới đây và tên cột native hợp lệ. Cột identity, GENERATED, khóa bất biến và trường không ánh xạ bị từ chối. Các handler chuyên biệt dùng payload đã nêu phía trên.\n\n| Tài nguyên | Bảng | Khóa chính | Alias → cột |\n|---|---|---|---|\n'+Object.entries(resources).map(([name,r])=>`| ${name} | ${r.table} | ${r.pk} | ${Object.entries(r.fields).map(([a,b])=>a+' → '+b).join('; ')} |`).join('\n');
const tests=`\n\n## Kiểm thử và tái tạo tài liệu

- npm test; npm run typecheck; npm run build.
- npm run test:spec: dùng DATABASE_URL để đọc schema bằng pg_dump --schema-only, tạo database mới mayday_test_spec_<timestamp>, chỉ ghi fixture vào database này, chạy HTTP thật và drop database kiểm thử ở cuối. Cần pg_dump/psql/createdb/dropdb cùng credential có quyền tạo database; không cần đọc dữ liệu bệnh nhân nguồn. Kết quả: docs/spec-api-test-results.json.
- Kiểm thử kiểm tra Swagger/401 cho 92 route, ít nhất một HTTP thành công cho từng API trong 67 API ánh xạ, 501 cho 25 chức năng còn lại, cùng các tình huống truy cập chéo, tranh nhận ca, gửi trùng UAS và rollback.
- npm run docs:api tái tạo file này từ catalog và resource mapping; sau thay đổi mapping phải chạy lại kiểm thử HTTP. Các ví dụ mang tính cấu trúc; không dùng ID fixture cố định cho database thật.
`;
writeFileSync('docs/API_SPEC_MAPPING.md',intro+rows+fields+tests);
console.log('Wrote docs/API_SPEC_MAPPING.md: 92 operations (67 mapped, 25 unsupported).');
