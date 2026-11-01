# API đặc tả — ánh xạ vào database hiện tại

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

## Ánh xạ trường của các tài nguyên

Nhận các alias dưới đây và tên cột native hợp lệ. Cột identity, GENERATED, khóa bất biến và trường không ánh xạ bị từ chối. Các handler chuyên biệt dùng payload đã nêu phía trên.

| Tài nguyên | Bảng | Khóa chính | Alias → cột |
|---|---|---|---|
| branches | chinhanh | ma_chi_nhanh | name → ten_chi_nhanh; address → dia_chi; phone → so_dien_thoai; is_active → trang_thai |
| departments | khoaphong | ma_khoa_phong | name → ten_khoa_phong; type → loai_khoa; description → mo_ta; branch_id → ma_chi_nhanh |
| rooms | phongkham | ma_phong_kham | name → ten_phong_kham; department_id → ma_khoa_phong |
| roles | vaitro | ma_vai_tro | name → ten_vai_tro; display_name → ten_hien_thi; description → mo_ta_vai_tro |
| permissions | quyenhan | ma_quyen_han | name → ten_quyen_han; group → nhom_quyen; description → mo_ta |
| users | taikhoan | ma_tai_khoan | person_id → ma_nguoi; role_id → ma_vai_tro; username → ten_dang_nhap; is_active → trang_thai_hoat_dong |
| people | nguoi | ma_nguoi | full_name → ho_ten; date_of_birth → ngay_sinh; gender → gioi_tinh; phone → so_dien_thoai; province → dia_chi_tinh_tp; ward → dia_chi_xa_phuong; address → dia_chi_so_nha_thon_pho |
| patients | benhnhan | ma_benh_nhan | his_id → ma_his; occupation → nghe_nghiep; ethnicity → dan_toc; insurance_number → bhyt_so_the; insurance_expiry → bhyt_gia_tri_den; relative_name_address → nguoi_nha_ho_ten_dia_chi; relative_phone → nguoi_nha_so_dien_thoai |
| records | hosobenhan | ma_ho_so | patient_id → ma_benh_nhan; record_type → loai_benh_an; status → trang_thai; first_exam_at → thoi_diem_kham_lan_dau; treatment_start → ngay_bat_dau_dieu_tri_ngoai_tru; treatment_end → ngay_ket_thuc_dieu_tri_ngoai_tru; previous_diagnosis → chan_doan_tuyen_truoc; initial_diagnosis → chan_doan_ban_dau_phong_kham; onset_weeks → thoi_gian_khoi_phat_tuan |
| scores | nhatkyuashangngay | ma_nhat_ky_uas | patient_id → ma_benh_nhan; medical_record_id → ma_ho_so_man; cycle_id → ma_chu_ky; score_date → ngay_cham_diem; day_in_cycle → ngay_thu_may_trong_chu_ky; hss_score → diem_san_phu_hss; iss_score → diem_ngua_iss; medication_status → trang_thai_dung_thuoc |
| episodes | dottonthuongda | ma_dot_ton_thuong_da | patient_id → ma_benh_nhan; medical_record_id → ma_ho_so_man; name → ten_dot_ton_thuong_da; onset_at → thoi_diem_xuat_hien; context → hoan_canh_xuat_hien; other_context → hoan_canh_xuat_hien_khac; medication_name → ten_thuoc_dung_gan_thoi_diem_xuat_hien; description → chi_tiet_dot_ton_thuong |
| locations | vitritonthuong | ma_vi_tri_ton_thuong | episode_id → ma_dot_ton_thuong_da; body_location → vi_tri_co_the; onset_at → thoi_diem_xuat_hien; medication_name → ten_thuoc_lien_quan; context → hoan_canh_xuat_hien; other_context → hoan_canh_xuat_hien_khac |
| photos | anhchuptonthuong | ma_anh | image_id → ma_tep_dinh_kem; attachment_id → ma_tep_dinh_kem; episode_id → ma_dot_ton_thuong_da; location_id → ma_vi_tri_ton_thuong; taken_at → thoi_diem_chup; milestone → moc_tien_trien; itch_score → diem_ngua_nrs; pain_score → diem_dau_nrs; burning_score → diem_bong_rat_nrs; wheal_count → so_luong_not_san |
| files | tepdinhkem | ma_tep_dinh_kem | medical_record_id → ma_ho_so; user_id → ma_tai_khoan; file_name → ten_tep_goc; mime_type → dinh_dang_tep; size → dung_luong_byte; purpose → phan_loai_muc_dich; description → mo_ta_tep |

## Kiểm thử và tái tạo tài liệu

- npm test; npm run typecheck; npm run build.
- npm run test:spec: dùng DATABASE_URL để đọc schema bằng pg_dump --schema-only, tạo database mới mayday_test_spec_<timestamp>, chỉ ghi fixture vào database này, chạy HTTP thật và drop database kiểm thử ở cuối. Cần pg_dump/psql/createdb/dropdb cùng credential có quyền tạo database; không cần đọc dữ liệu bệnh nhân nguồn. Kết quả: docs/spec-api-test-results.json.
- Kiểm thử kiểm tra Swagger/401 cho 92 route, ít nhất một HTTP thành công cho từng API trong 67 API ánh xạ, 501 cho 25 chức năng còn lại, cùng các tình huống truy cập chéo, tranh nhận ca, gửi trùng UAS và rollback.
- npm run docs:api tái tạo file này từ catalog và resource mapping; sau thay đổi mapping phải chạy lại kiểm thử HTTP. Các ví dụ mang tính cấu trúc; không dùng ID fixture cố định cho database thật.
