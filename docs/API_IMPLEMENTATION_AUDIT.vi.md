# Đối chiếu API đặc tả và triển khai MayDay

Ngày kiểm tra: 12/11/2026. Nguồn đặc tả: `docs/MayDay.md`, đặc biệt phần API và thiết kế dữ liệu trang nguồn 24–30. Nguồn triển khai: `apps/api/src/spec/{catalog,controller,service,accounts,clinical,media,resources}.ts`, NativeController/NativeService, Prisma schema và database thực tế được kết nối bằng cấu hình trong `.env` ở gốc dự án.

## 1. Kết quả và phạm vi xác minh

- 92 thao tác riêng biệt trong đặc tả, được đăng ký thành 92 route trong SpecController.
- 67/92 thao tác (72,8%) có nhánh xử lý dữ liệu; đây là triển khai thích nghi với database hiện tại, không đồng nghĩa tương thích đầy đủ mọi DTO và hành vi trong đặc tả cũ.
- 25/92 thao tác (27,2%) chỉ có route chờ: `action: unsupported`. SpecService trả HTTP 501, mã nghiệp vụ 5010, sau bước xác thực/phân quyền đối với route riêng tư. Không được tính các route này là đã triển khai chức năng.
- Database kiểm tra trực tiếp có **44 bảng thật và 1 view** `v_chukytheodoiuas7`. Cả 44 bảng trong snapshot `apps/api/src/native/schema.json` đều tồn tại; không thiếu/thừa tên cột trên các bảng này. Đối chiếu tên cột không phải xác nhận mọi kiểu dữ liệu, trigger, quyền hoặc index đều giống nhau.
- Các truy vấn kiểm tra chỉ đọc metadata: bảng, cột, khóa ngoại và CHECK; không đọc hồ sơ bệnh nhân, không migration, seed hoặc sửa dữ liệu nghiệp vụ.
- Báo cáo HTTP có sẵn `docs/spec-api-test-results.json` được tạo ngày 09/11/2026: ghi nhận 67 thao tác có HTTP thành công và 25 thao tác trả 501 trên database kiểm thử tạm. Đây là bằng chứng lịch sử, không phải kết quả chạy lại HTTP trên database thật hôm nay.

Nguyên nhân gốc là **hai mô hình dữ liệu khác nhau**: đặc tả mô tả 29 bảng theo mô hình biểu mẫu động với tên tiếng Anh; triển khai dùng 44 bảng lâm sàng cố định với tên tiếng Việt, bệnh án/phiên khám subtype CAP và MAN. Số bảng lớn hơn không có nghĩa đã có đủ các thực thể trong đặc tả.

## 2. Toàn bộ 25 API chưa có xử lý nghiệp vụ

Mọi đường dẫn dưới đây có tiền tố `/api/v1`.

| Nhóm | Method và đường dẫn | Số API | Điểm thiếu hoặc không tương thích |
|---|---|---:|---|
| Quên mật khẩu | `POST /auth/forgot-password` | 1 | Đặc tả yêu cầu lưu `users.reset_token` và gửi mã SMS. Bảng thay thế `taikhoan` không có trường này; không có bảng reset token/OTP. Mã nguồn chưa có luồng phát, xác minh, hết hạn, dùng một lần và gửi mã khôi phục. |
| Phân loại bệnh án | `GET /medical_records/classify-questions`; `POST /medical_records/classify` | 2 | Thiếu mô hình câu hỏi/lựa chọn phân loại và bộ quy tắc nghiệp vụ đã được xác định; các cột lâm sàng cố định không tự thay thế được biểu mẫu động. |
| Câu trả lời phiếu khám | `GET /medical_records/:id/answers`; `PUT /medical_records/:id/answers` | 2 | Không có `answers`, `questions`, khóa ngoại tới hồ sơ/câu hỏi, ràng buộc `UNIQUE(medical_record_id, question_id)` theo đặc tả. |
| Xóa bệnh án | `DELETE /medical_records/:id` | 1 | Handler chủ động không cho xóa. Database có nhiều FK RESTRICT/NO ACTION và quan hệ subtype bắt buộc, deferred; chưa có quy trình xóa toàn bộ đồ thị liên quan hoặc cơ chế xóa mềm được thống nhất. Đây là cả chính sách giữ hồ sơ và giới hạn triển khai, không đơn thuần thiếu bảng. |
| Chỉ định xét nghiệm | `POST /lab-requests` | 1 | Thiếu `lab_requests` và `lab_request_items`. Chỉ có `ketquacanlamsang` và subtype CAP/MAN lưu **kết quả**, liên kết phiên khám; không có thực thể lưu yêu cầu trước khi có kết quả. |
| Ảnh gắn với câu trả lời | `POST /answer-images`; `GET /answer-images/:answer_id`; `DELETE /answer-images/:id` | 3 | Có `tepdinhkem` nhưng thiếu `answers` và bảng nối `answer_images`. Không lưu được quan hệ N–N ảnh–câu trả lời đúng đặc tả. |
| Token thiết bị | `POST /notifications` | 1 | Thiếu `user_fcm_tokens` hoặc thực thể tương đương để gắn token với tài khoản/thiết bị, cập nhật và thu hồi. Chưa tích hợp dịch vụ gửi push trong các module đang được đăng ký. |
| Hộp thông báo | `GET /notifications`; `PUT /notifications/:id/read`; `DELETE /notifications/:id` | 3 | Thiếu `notifications`: không có nơi lưu người nhận, nội dung, trạng thái đã đọc và lịch sử. `user_notification_settings` trong thiết kế cũng chưa có. |
| Mẫu phiếu khám | `POST /templates`; `GET /templates/all`; `GET /templates/:id`; `PUT /templates/:id`; `DELETE /templates/:id` | 5 | Thiếu `templates` cùng quan hệ mẫu–hồ sơ; các bảng bệnh án cố định không chứa định nghĩa template. |
| Phần của mẫu | `POST /templates/:template_id/sections`; `PUT /templates/sections/:id`; `DELETE /templates/sections/:id` | 3 | Thiếu `template_sections` và FK đến template, cấu trúc lưu các phần của mẫu. |
| Câu hỏi trong phần | `POST /templates/sections/:section_id/questions`; `PUT /templates/questions/:id`; `DELETE /templates/questions/:id` | 3 | Thiếu `questions`, `question_options`, loại câu hỏi, `parent_question_id`, `show_if_answer`, `condition_rules` và liên kết tới section. |
| **Tổng** | | **25** | |

Trong 25 API trên, 18 API phụ thuộc hệ biểu mẫu/câu trả lời: 11 builder + 2 phân loại + 2 answers + 3 answer-images.

### Các ràng buộc xóa đã xác minh trực tiếp

- `donthuoc.ma_ho_so → hosobenhan.ma_ho_so`: `ON DELETE RESTRICT`.
- `tepdinhkem.ma_ho_so → hosobenhan.ma_ho_so`: `ON DELETE RESTRICT`.
- `dottonthuongda`, nhật ký UAS/AAS, `tiensubanthan`, `hoancanhkhoiphatdiung` cũng tham chiếu bệnh án bằng FK RESTRICT.
- `phienkham` tham chiếu bệnh án với hành vi mặc định NO ACTION.
- `hosobenhan.ma_subtype_cap/man` tham chiếu bảng subtype, và subtype tham chiếu ngược bệnh án; các FK bắt buộc này là `DEFERRABLE INITIALLY DEFERRED`.

Do đó một câu lệnh DELETE bệnh án không thể thay thế quy trình xóa nghiệp vụ. Tuy nhiên, deferred FK không có nghĩa việc xóa là bất khả thi về kỹ thuật: có thể thiết kế transaction phù hợp hoặc xóa mềm sau khi thống nhất chính sách. Không nên tự đổi hàng loạt FK thành CASCADE.

### Phân biệt thiếu cấu hình và thiếu chức năng

File `.env` có cấu hình kết nối database hoạt động; không phải lỗi mất kết nối khiến 25 API trả 501. Lỗi 501 được quyết định rõ ràng trong catalog/service, không tự biến mất khi thêm biến môi trường.

Trong `.env`, `FIREBASE_SERVICE_ACCOUNT_PATH` có mặt nhưng để trống. Các biến email/reset xuất hiện trong môi trường tiến trình không nằm trong chính file `.env` đã kiểm tra; chưa xác minh tính hợp lệ của dịch vụ đó. Dự án có dependency `firebase-admin`, nhưng cài package không đồng nghĩa đã tích hợp gửi thông báo. Ngoài ra, đặc tả quên mật khẩu yêu cầu SMS; cấu hình email riêng không tự đáp ứng yêu cầu này.

## 3. Các API có xử lý nhưng chưa tương thích đầy đủ đặc tả

| API/nhóm | Thực tế triển khai | Khác biệt cần lưu ý |
|---|---|---|
| Tài khoản/hồ sơ | Ghép `nguoi`, `benhnhan` hoặc `nhanvien`, `taikhoan` | Đặc tả dùng users/staffs/patients. ID tài khoản và ID người/bệnh nhân là các định danh cần phân biệt, không thay thế tùy tiện. |
| `PUT /admin/users/:id/assign` | Gán chi nhánh qua `nhanvien.ma_chi_nhanh` | `nhanvien` không có FK khoa/phòng. `phienkham.ma_phong_kham` là phòng của lượt khám, không phải phân công cố định nhân viên. |
| `POST /roles` | Tạo vai trò phẳng trong `vaitro` | Không có `parent_role_id` để biểu diễn kế thừa vai trò. |
| Role/permission CRUD | Có `quyenhan`, `vaitroquyenhan`; khóa ghép vai trò + quyền | Thiếu `api_endpoints`, `permissions_endpoints` theo thiết kế. Chính sách truy cập hiện tại dựa trên vai trò định sẵn, chưa phải RBAC động tới endpoint. Chỉ bổ sung bảng cũng chưa đủ, phải thay đổi cơ chế kiểm tra quyền. |
| `DELETE /admin/users/:id` | Đặt tài khoản ngừng hoạt động | Khóa tài khoản thay vì xóa người và các quan hệ lâm sàng. |
| Đăng ký/profile | Giới tính theo CHECK `Nam/Nu`; hỗ trợ alias male/female | Giá trị `other` không được DB chấp nhận. Quy tắc mật khẩu hiện tại tối thiểu 10 ký tự, tối đa 72 byte là quy tắc ứng dụng; khác yêu cầu cũ không nhất thiết do DB. |
| Department CRUD | Ánh xạ `khoaphong` | Schema hiện tại yêu cầu `type` → `loai_khoa`. |
| Room CRUD | Ánh xạ `phongkham` | Không có cột `description`; trường không có ánh xạ bị từ chối. |
| `POST /doctor/patients` | Tạo `nguoi + benhnhan` | Không tự tạo tài khoản/mật khẩu; tạo tài khoản dùng signup hoặc admin/users. |
| Tạo/tiếp nhận/chốt bệnh án | `hosobenhan` + subtype; tiếp nhận tạo `phienkham`, bác sĩ lưu ở `ma_bac_si`; dặn dò lưu `dan_do` của phiên khám | Không có `template_id`, `assigned_doctor_id`, `completed_at` trực tiếp trên hồ sơ như mô hình cũ. PUT chốt chỉ nhận `instructions`, không đồng thời cập nhật phiếu answers động. |
| UAS7 | Dùng `nhatkyuashangngay`, hồ sơ MAN và chu kỳ theo dõi | HSS/ISS nguyên 0–3; điểm tổng do PostgreSQL tính. Có kiểm tra sở hữu, ngày hiện tại và chống trùng bằng transaction. Không nên xem đây là tương thích tuyệt đối với mọi trường/thuật toán của `uas7_scores` cũ. |
| Kê đơn/đọc xét nghiệm | `donthuoc + chitietdonthuoc + thuoc`; kết quả qua `ketquacanlamsang` và subtype | Có xử lý kê đơn và đọc kết quả không có nghĩa đã có luồng tạo chỉ định xét nghiệm. |
| Upload/đọc/xóa ảnh | `tepdinhkem` + private local storage, endpoint đọc có xác thực | Không phải tích hợp MinIO/S3 tự động. Một số đường dẫn tệp nhập từ kho cũ chưa có bộ đọc và có thể trả 501 dù route media đã được triển khai. Tệp còn được ảnh tổn thương tham chiếu bị chặn xóa. |
| Tổn thương/vị trí/ảnh | `dottonthuongda`, `vitritonthuong`, `anhchuptonthuong` | Xóa bị chi phối bởi FK; không tự xóa cascade các bản ghi phụ thuộc. Route lphoto02 đã sửa lỗi đường dẫn bị chép lặp trong tài liệu thành `/lesion-photos/location/:location_id`. |
| Xác thực phiên | NativeService dùng session token và file lưu phiên | Không dùng toàn bộ mô hình JWT/token_blacklist trong thiết kế cũ. Thiếu bảng token_blacklist không đồng nghĩa login/logout chưa triển khai. |

Vì một số bảng DTO trong tài liệu nguồn được nhúng dưới dạng ảnh, báo cáo này không khẳng định đã kiểm tra từng trường của mọi hình minh họa. Phạm vi xác nhận gồm đủ 92 thao tác, luồng xử lý và các khác biệt schema/hành vi nêu rõ ở trên.

## 4. API thực tế bổ sung ngoài danh mục 92 thao tác

Các API dưới đây có mã xử lý riêng, không cộng vào mẫu số 92:

- `GET /api/v1/auth/me`, `GET /api/v1/auth/profile`, `POST /api/v1/auth/change-password`: API tương thích của NativeController.
- `GET /api/v1/data/schema`, `POST /api/v1/data/patients`, cùng GET/POST/PATCH/DELETE theo `/api/v1/data/:table[/:key]`: truy cập dữ liệu native, chịu phân quyền và ràng buộc của NativeService; có route tổng quát không có nghĩa mọi thao tác trên mọi bảng đều được phép.
- `GET /api/v1/image-attachments/:id/content`: đọc tệp riêng tư sau kiểm tra quyền bệnh án.
- `POST /api/v1/ai/analyze`: phân tích ảnh bằng ba model; trả `persisted: false`, chưa tự lưu ảnh/kết quả vào database. Đây không phải nguyên nhân của 25 route unsupported.
- `GET /api/v1/health`: kiểm tra hoạt động dịch vụ.

## 5. Những việc cần làm để lấp khoảng thiếu

Đây là đề xuất triển khai, chưa thay đổi database:

1. Thống nhất duy trì mô hình lâm sàng hiện tại và bổ sung biểu mẫu động hay thay đổi hợp đồng đặc tả. Nếu bổ sung, cần templates → template_sections → questions → question_options, answers liên kết bệnh án, và answer_images liên kết `tepdinhkem`. Cần quản lý phiên bản mẫu để sửa câu hỏi không làm sai hồ sơ lịch sử; quy tắc phân loại cần được xác nhận riêng.
2. Thêm bảng yêu cầu và mục xét nghiệm; thiết kế liên kết kết quả với chỉ định và phiên khám, trạng thái và quyền thao tác. Không tạo bản ghi kết quả rỗng để giả làm chỉ định.
3. Thêm kho mã khôi phục có mã băm, hết hạn, số lần thử và trạng thái đã dùng; triển khai xác minh/gửi mã theo kênh đã chọn. Thêm cấu hình đơn thuần không đủ.
4. Thêm token thiết bị, thông báo và cài đặt nhận tin; tích hợp FCM với credentials hợp lệ, xử lý token hết hiệu lực và quyền đọc thông báo của người nhận.
5. Thống nhất xóa mềm/hủy bệnh án hay xóa vật lý có điều kiện; triển khai chính sách rõ ràng trước khi sửa hành vi DELETE/FK.
6. Nếu cần đúng đặc tả quản trị: bổ sung phân công nhân viên khoa/phòng, phân cấp vai trò và ánh xạ quyền–endpoint, rồi cập nhật handler/guard và kiểm thử quyền tương ứng.

Không cần đổi tên toàn bộ bảng sang tiếng Anh để thực hiện các việc này: tầng ánh xạ đã tồn tại. Phần thiếu chính là thực thể, quan hệ và hành vi nghiệp vụ, không phải ngôn ngữ đặt tên bảng.

## 6. Bảng đối chiếu đầy đủ 92 thao tác

Bảng dưới trích từ `docs/API_SPEC_MAPPING.md`, đã đối chiếu với catalog và nhánh dispatch hiện tại. “Ánh xạ” có nghĩa có handler xử lý; cần đọc các giới hạn ở phần 3, không hiểu là đạt hoàn toàn đặc tả cũ.

| STT | Mục trong đặc tả | Method | Đường dẫn | Trạng thái | Bảng / giới hạn |
|---:|---|---|---|---|---|
| 1 | signup | POST | /api/v1/auth/signup | Ánh xạ | Xử lý nghiệp vụ chuyên biệt |
| 2 | login | POST | /api/v1/auth/login | Ánh xạ | Xử lý nghiệp vụ chuyên biệt |
| 3 | logout | POST | /api/v1/auth/logout | Ánh xạ | Xử lý nghiệp vụ chuyên biệt |
| 4 | forgot-password | POST | /api/v1/auth/forgot-password | Chưa hỗ trợ (501) | Không có kho reset token và kênh xác minh khôi phục tài khoản; không phát token hoặc thay mật khẩu. |
| 5 | change-password | PUT | /api/v1/auth/change-password | Ánh xạ | Xử lý nghiệp vụ chuyên biệt |
| 6 | create-staff | POST | /api/v1/auth/admin/create-staff | Ánh xạ | Xử lý nghiệp vụ chuyên biệt |
| 7 | GET profile | GET | /api/v1/profile | Ánh xạ | Xử lý nghiệp vụ chuyên biệt |
| 8 | PUT profile | PUT | /api/v1/profile | Ánh xạ | Xử lý nghiệp vụ chuyên biệt |
| 9 | get_list_users(admin02) | GET | /api/v1/admin/users | Ánh xạ | taikhoan |
| 10 | get_user_details(admin03) | GET | /api/v1/admin/users/:id | Ánh xạ | taikhoan |
| 11 | create_user (admin01) | POST | /api/v1/admin/users | Ánh xạ | Xử lý nghiệp vụ chuyên biệt |
| 12 | edit_user (admin04) | PUT | /api/v1/admin/users/:id | Ánh xạ | Xử lý nghiệp vụ chuyên biệt |
| 13 | delete_user (admin05) | DELETE | /api/v1/admin/users/:id | Ánh xạ | Khóa tài khoản thay vì xóa người và lịch sử lâm sàng. |
| 14 | assign_user (admin06) | PUT | /api/v1/admin/users/:id/assign | Ánh xạ | Chỉ ánh xạ chi nhánh; nhanvien không có khóa khoa/phòng. |
| 15 | set_role (role01) | POST | /api/v1/roles | Ánh xạ | vaitro; Vai trò phẳng; không có parent_role_id. Quyền lâm sàng vẫn theo chính sách NativeGuard. |
| 16 | get_role (role02) | GET | /api/v1/roles | Ánh xạ | vaitro |
| 17 | set_permission(perm01) | POST | /api/v1/permissions | Ánh xạ | quyenhan |
| 18 | get_list_permissions (perm02) | GET | /api/v1/permissions | Ánh xạ | quyenhan |
| 19 | edit_permission(perm03) | PUT | /api/v1/permissions/:id | Ánh xạ | quyenhan |
| 20 | delete_permission(perm04) | DELETE | /api/v1/permissions/:id | Ánh xạ | quyenhan |
| 21 | set_role_permissions(roleperm01) | POST | /api/v1/role_permissions | Ánh xạ | Lưu gán quyền vào khóa ghép vaitroquyenhan; không có role_permission_id hay ánh xạ quyền-endpoint động. |
| 22 | get_role_permissions(roleperm02) | GET | /api/v1/role_permissions/:role_id | Ánh xạ | Xử lý nghiệp vụ chuyên biệt |
| 23 | delete_role_permissions(roleperm03) | DELETE | /api/v1/role_permissions/:role_id/:permission_id | Ánh xạ | Xử lý nghiệp vụ chuyên biệt |
| 24 | set_branch (branch01) | POST | /api/v1/branches | Ánh xạ | chinhanh |
| 25 | get_list_branches (branch02) | GET | /api/v1/branches | Ánh xạ | chinhanh |
| 26 | get_branch_detail (branch03) | GET | /api/v1/branches/:id | Ánh xạ | chinhanh |
| 27 | edit_branch (branch04) | PUT | /api/v1/branches/:id | Ánh xạ | chinhanh |
| 28 | delete_branch (branch05) | DELETE | /api/v1/branches/:id | Ánh xạ | chinhanh |
| 29 | set_department(dept01) | POST | /api/v1/departments | Ánh xạ | khoaphong; Schema yêu cầu thêm type (loai_khoa). |
| 30 | get_list_departments(dept02) | GET | /api/v1/departments | Ánh xạ | khoaphong |
| 31 | get_department_detail(dept03) | GET | /api/v1/departments/:id | Ánh xạ | khoaphong |
| 32 | edit_department(dept04) | PUT | /api/v1/departments/:id | Ánh xạ | khoaphong |
| 33 | delete_department(dept05) | DELETE | /api/v1/departments/:id | Ánh xạ | khoaphong |
| 34 | set_room (room01) | POST | /api/v1/rooms | Ánh xạ | phongkham; Không có cột description; gửi trường này sẽ bị từ chối. |
| 35 | get_list_rooms (room02) | GET | /api/v1/rooms | Ánh xạ | phongkham |
| 36 | get_room_detail (room03) | GET | /api/v1/rooms/:id | Ánh xạ | phongkham |
| 37 | edit_room (room04) | PUT | /api/v1/rooms/:id | Ánh xạ | phongkham |
| 38 | delete_room (room05) | DELETE | /api/v1/rooms/:id | Ánh xạ | phongkham |
| 39 | search_patients (docpat01) | GET | /api/v1/doctor/patients/search | Ánh xạ | Xử lý nghiệp vụ chuyên biệt |
| 40 | create_patient (docpat02) | POST | /api/v1/doctor/patients | Ánh xạ | Tiếp nhận tạo nguoi + benhnhan; tạo tài khoản đăng nhập dùng signup/admin users. Không sinh mật khẩu ngẫu nhiên. |
| 41 | get_medicalrecords_classifyquestions (medrec01) | GET | /api/v1/medical_records/classify-questions | Chưa hỗ trợ (501) | Schema hiện tại không có templates, sections, questions, options hoặc answers. Không lưu biểu mẫu/câu trả lời động vào bảng lâm sàng khác. |
| 42 | set_medicalrecords_classify (medrec02) | POST | /api/v1/medical_records/classify | Chưa hỗ trợ (501) | Schema hiện tại không có templates, sections, questions, options hoặc answers. Không lưu biểu mẫu/câu trả lời động vào bảng lâm sàng khác. Không suy đoán quy tắc phân loại lâm sàng. |
| 43 | set_medicalrecords_create(medrec03) | POST | /api/v1/medical_records | Ánh xạ | Xử lý nghiệp vụ chuyên biệt |
| 44 | get_medicalrecords_all(medrec04) | GET | /api/v1/medical_records/all | Ánh xạ | hosobenhan |
| 45 | get_medicalrecords_id(medrec05) | GET | /api/v1/medical_records/:id | Ánh xạ | hosobenhan |
| 46 | get_medicalrecords_summary(medrec06) | GET | /api/v1/medical_records/:id/summary | Ánh xạ | Xử lý nghiệp vụ chuyên biệt |
| 47 | get_history_medicalrecords(medrec13) | GET | /api/v1/medical_records/patients/:id/history | Ánh xạ | Xử lý nghiệp vụ chuyên biệt |
| 48 | set_accept_medicalrecords(medrec07) | POST | /api/v1/medical_records/:id/accept | Ánh xạ | Tạo phiên khám và gán ma_bac_si trong transaction; không có assigned_doctor_id trên hồ sơ. |
| 49 | credit_medicalrecords(medrec11) | PUT | /api/v1/medical_records/:id | Ánh xạ | Chốt hồ sơ; instructions lưu tại dan_do của phiên khám. Không có completed_at trên hồ sơ. |
| 50 | get_medicalrecords_answers(medrec08) | GET | /api/v1/medical_records/:id/answers | Chưa hỗ trợ (501) | Schema hiện tại không có templates, sections, questions, options hoặc answers. Không lưu biểu mẫu/câu trả lời động vào bảng lâm sàng khác. |
| 51 | update_medicalrecords_answers (medrec10) | PUT | /api/v1/medical_records/:id/answers | Chưa hỗ trợ (501) | Schema hiện tại không có templates, sections, questions, options hoặc answers. Không lưu biểu mẫu/câu trả lời động vào bảng lâm sàng khác. |
| 52 | delete_medicalrecords(medrec14) | DELETE | /api/v1/medical_records/:id | Chưa hỗ trợ (501) | Giữ hồ sơ lâm sàng theo quy tắc database hiện tại; các FK RESTRICT và subtype deferred không hỗ trợ xóa cascade theo đặc tả cũ. |
| 53 | get_uas7scores_eligibility (uas701) | GET | /api/v1/uas7-scores/eligibility | Ánh xạ | Xử lý nghiệp vụ chuyên biệt |
| 54 | create_uas7scores (uas702) | POST | /api/v1/uas7-scores | Ánh xạ | Xử lý nghiệp vụ chuyên biệt |
| 55 | get_uas7scores_patient (uas704) | GET | /api/v1/uas7-scores/patient/:patient_id | Ánh xạ | Xử lý nghiệp vụ chuyên biệt |
| 56 | create_prescription(rx01) | POST | /api/v1/prescriptions | Ánh xạ | Xử lý nghiệp vụ chuyên biệt |
| 57 | create_lab_request(lab01) | POST | /api/v1/lab-requests | Chưa hỗ trợ (501) | Chỉ có bảng kết quả cận lâm sàng, không có bảng chỉ định xét nghiệm. Không tạo kết quả giả để thay chỉ định. |
| 58 | get_lab_results (lab02) | GET | /api/v1/lab-results/:record_id | Ánh xạ | Xử lý nghiệp vụ chuyên biệt |
| 59 | upload_image_attachment (img01) | POST | /api/v1/image-attachments/upload | Ánh xạ | Lưu file private local và metadata tepdinhkem; yêu cầu medical_record_id. Không tự cấu hình MinIO/S3. |
| 60 | get_image_attachments_user (img03) | GET | /api/v1/image-attachments/user/:user_id | Ánh xạ | Xử lý nghiệp vụ chuyên biệt |
| 61 | delete_image_attachment (img05) | DELETE | /api/v1/image-attachments/:id | Ánh xạ | FK chặn tệp đang được ảnh tổn thương tham chiếu. |
| 62 | set_answer_image (ansimg01) | POST | /api/v1/answer-images | Chưa hỗ trợ (501) | Schema hiện tại không có templates, sections, questions, options hoặc answers. Không lưu biểu mẫu/câu trả lời động vào bảng lâm sàng khác. |
| 63 | get_answer_images (ansimg03) | GET | /api/v1/answer-images/:answer_id | Chưa hỗ trợ (501) | Schema hiện tại không có templates, sections, questions, options hoặc answers. Không lưu biểu mẫu/câu trả lời động vào bảng lâm sàng khác. |
| 64 | delete_answer_image (ansimg04) | DELETE | /api/v1/answer-images/:id | Chưa hỗ trợ (501) | Schema hiện tại không có templates, sections, questions, options hoặc answers. Không lưu biểu mẫu/câu trả lời động vào bảng lâm sàng khác. |
| 65 | create_lesion_episode (lesion02) | POST | /api/v1/lesion-episodes | Ánh xạ | dottonthuongda |
| 66 | get_my_lesion_episodes (lesion01) | GET | /api/v1/lesion-episodes/my | Ánh xạ | Xử lý nghiệp vụ chuyên biệt |
| 67 | get_lesion_episode (lesion06) | GET | /api/v1/lesion-episodes/:id | Ánh xạ | dottonthuongda |
| 68 | edit_lesion_episode (lesion03) | PATCH | /api/v1/lesion-episodes/:id | Ánh xạ | dottonthuongda |
| 69 | delete_lesion_episode (lesion04) | DELETE | /api/v1/lesion-episodes/:id | Ánh xạ | dottonthuongda |
| 70 | create_lesion_location (loc01) | POST | /api/v1/lesion-locations | Ánh xạ | vitritonthuong |
| 71 | get_lesion_locations_by_episode (loc03) | GET | /api/v1/lesion-locations/episode/:episode_id | Ánh xạ | Xử lý nghiệp vụ chuyên biệt |
| 72 | edit_lesion_location (loc04) | PATCH | /api/v1/lesion-locations/:id | Ánh xạ | vitritonthuong |
| 73 | delete_lesion_location (loc05) | DELETE | /api/v1/lesion-locations/:id | Ánh xạ | vitritonthuong |
| 74 | set_lesion_photos (lphoto01) | POST | /api/v1/lesion-photos | Ánh xạ | Xử lý nghiệp vụ chuyên biệt |
| 75 | get_lesion_photos_by_location (lphoto02) | GET | /api/v1/lesion-photos/location/:location_id | Ánh xạ | Sửa lỗi copy nhầm đường dẫn loc03 trong đoạn mô tả lphoto02 của tài liệu. |
| 76 | edit_lesion_photo_milestone (lphoto03) | PATCH | /api/v1/lesion-photos/:id/milestone | Ánh xạ | Xử lý nghiệp vụ chuyên biệt |
| 77 | delete_lesion_photo (lphoto04) | DELETE | /api/v1/lesion-photos/:id | Ánh xạ | anhchuptonthuong |
| 78 | set_devtoken (token01) | POST | /api/v1/notifications | Chưa hỗ trợ (501) | Không có bảng token thiết bị hoặc dịch vụ gửi thông báo được cấu hình. |
| 79 | get_notification (notif01) | GET | /api/v1/notifications | Chưa hỗ trợ (501) | Không có bảng thông báo trong schema hiện tại. |
| 80 | set_read_notification (notif02) | PUT | /api/v1/notifications/:id/read | Chưa hỗ trợ (501) | Không có bảng thông báo trong schema hiện tại. |
| 81 | delete_notification (notif04) | DELETE | /api/v1/notifications/:id | Chưa hỗ trợ (501) | Không có bảng thông báo trong schema hiện tại. |
| 82 | set_template (tmpl01) | POST | /api/v1/templates | Chưa hỗ trợ (501) | Schema hiện tại không có templates, sections, questions, options hoặc answers. Không lưu biểu mẫu/câu trả lời động vào bảng lâm sàng khác. |
| 83 | get_list_templates(tmpl02) | GET | /api/v1/templates/all | Chưa hỗ trợ (501) | Schema hiện tại không có templates, sections, questions, options hoặc answers. Không lưu biểu mẫu/câu trả lời động vào bảng lâm sàng khác. |
| 84 | get_template_detail(tmpl03) | GET | /api/v1/templates/:id | Chưa hỗ trợ (501) | Schema hiện tại không có templates, sections, questions, options hoặc answers. Không lưu biểu mẫu/câu trả lời động vào bảng lâm sàng khác. |
| 85 | edit_template (tmpl04) | PUT | /api/v1/templates/:id | Chưa hỗ trợ (501) | Schema hiện tại không có templates, sections, questions, options hoặc answers. Không lưu biểu mẫu/câu trả lời động vào bảng lâm sàng khác. |
| 86 | delete_template(tmpl05) | DELETE | /api/v1/templates/:id | Chưa hỗ trợ (501) | Schema hiện tại không có templates, sections, questions, options hoặc answers. Không lưu biểu mẫu/câu trả lời động vào bảng lâm sàng khác. |
| 87 | set_template_section(sec01) | POST | /api/v1/templates/:template_id/sections | Chưa hỗ trợ (501) | Schema hiện tại không có templates, sections, questions, options hoặc answers. Không lưu biểu mẫu/câu trả lời động vào bảng lâm sàng khác. |
| 88 | edit_template_section(sec02) | PUT | /api/v1/templates/sections/:id | Chưa hỗ trợ (501) | Schema hiện tại không có templates, sections, questions, options hoặc answers. Không lưu biểu mẫu/câu trả lời động vào bảng lâm sàng khác. |
| 89 | delete_template_section (sec03) | DELETE | /api/v1/templates/sections/:id | Chưa hỗ trợ (501) | Schema hiện tại không có templates, sections, questions, options hoặc answers. Không lưu biểu mẫu/câu trả lời động vào bảng lâm sàng khác. |
| 90 | set_template_question(ques01) | POST | /api/v1/templates/sections/:section_id/questions | Chưa hỗ trợ (501) | Schema hiện tại không có templates, sections, questions, options hoặc answers. Không lưu biểu mẫu/câu trả lời động vào bảng lâm sàng khác. |
| 91 | edit_template_question(ques02) | PUT | /api/v1/templates/questions/:id | Chưa hỗ trợ (501) | Schema hiện tại không có templates, sections, questions, options hoặc answers. Không lưu biểu mẫu/câu trả lời động vào bảng lâm sàng khác. |
| 92 | delete_template_question(ques03) | DELETE | /api/v1/templates/questions/:id | Chưa hỗ trợ (501) | Schema hiện tại không có templates, sections, questions, options hoặc answers. Không lưu biểu mẫu/câu trả lời động vào bảng lâm sàng khác. |
