# Luồng điều hướng và đối chiếu API

Đối chiếu tĩnh: **67/67 chức năng được hỗ trợ có điểm vào giao diện (100%)**. Backend hiện hỗ trợ 67/92 chức năng đặc tả (72.83%); 25 chức năng trả 501.

Đây là kiểm tra tham chiếu API và ánh xạ màn hình, không phải kết quả chạy thành công toàn bộ API từ trình duyệt. Kiểm thử HTTP backend và browser smoke được báo cáo riêng.

## Điều hướng

- Bệnh nhân vào Hôm nay; bác sĩ vào Hồ sơ bệnh án; điều dưỡng vào Bệnh nhân; quản trị vào Tổng quan quản trị.
- URL dùng `?view=records&record=<id>&tab=labs`, `?view=patients&patient=<id>` và `?view=lesions&patient=<id>&medical_record=<id>&episode=<id>&location=<id>`. Bookmark `?table=...` cũ tiếp tục hoạt động.
- Bộ lọc, tìm kiếm, phân trang và tab nằm trong URL. Back/Forward phục hồi màn hình; hộp thoại xác nhận bảo vệ biểu mẫu chưa lưu. Tải lại/rời website dùng cảnh báo của trình duyệt.
- Hành trình bệnh nhân nối hồ sơ, UAS và ảnh. Ảnh có thể tải ngay trong vị trí tổn thương và gắn vào ảnh tiến triển; khi gắn lỗi, ảnh đã upload vẫn có trong kho.
- Bệnh nhân chỉ xem dữ liệu của mình; menu cơ sở và hồ sơ chuyên sâu dành cho nhân viên. Server tiếp tục là nơi quyết định quyền cuối cùng.
- Phân tích AI mở từ ảnh riêng tư đã tải với Bearer; ảnh/kết quả AI chưa được lưu vào bệnh án.

## Kiểm tra lại

```powershell
npm run typecheck
npm test
npm run build
npm run audit:web-api
# Terminal riêng: khởi động web cho browser smoke:
npm run dev -w @mayday/web -- --port 5186 --strictPort
# Terminal khác:
npm run test:navigation
```

Browser smoke dùng Playwright với Edge trên Windows nếu có; máy khác cần `npx playwright install chromium` hoặc `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. Có thể đặt `NAVIGATION_BASE_URL` để đổi địa chỉ web. Mọi request `/api/v1/*` trong browser smoke được chặn và trả dữ liệu fixture. Kết quả/ảnh chụp nằm ở `.data/navigation-check/`.

Kiểm thử React bao gồm bookmark, tab, Back/Forward, hủy rời biểu mẫu chưa lưu, UAS ngày hiện tại và khóa ngữ cảnh bệnh nhân. Browser smoke xác minh landing theo 4 vai trò, luồng khám, upload–gắn ảnh, menu mobile và đăng nhập lại sau hết phiên. Chưa coi đây là E2E đầy đủ cho cả 67 API. Test database riêng bị bỏ qua khi không đặt `TEST_DATABASE_URL`.

## Điểm vào của từng chức năng

| Method | API | Luồng giao diện | Mã nguồn |
|---|---|---|---|
| POST | `/api/v1/auth/signup` | Đăng nhập → Đăng ký bệnh nhân | [care-account.tsx](../apps/web/src/care-account.tsx) |
| POST | `/api/v1/auth/login` | Đăng nhập / menu tài khoản | [NativeApp.tsx](../apps/web/src/NativeApp.tsx) |
| POST | `/api/v1/auth/logout` | Đăng nhập / menu tài khoản | [NativeApp.tsx](../apps/web/src/NativeApp.tsx) |
| PUT | `/api/v1/auth/change-password` | Đăng nhập / menu tài khoản | [NativeApp.tsx](../apps/web/src/NativeApp.tsx) |
| POST | `/api/v1/auth/admin/create-staff` | Tài khoản & nhân viên → Tạo nhân viên | [care-account.tsx](../apps/web/src/care-account.tsx) |
| GET | `/api/v1/profile` | Hồ sơ cá nhân → Xem / sửa | [care-account.tsx](../apps/web/src/care-account.tsx) |
| PUT | `/api/v1/profile` | Hồ sơ cá nhân → Xem / sửa | [care-account.tsx](../apps/web/src/care-account.tsx) |
| GET | `/api/v1/admin/users` | Tài khoản & nhân viên → Danh sách / chi tiết / tạo / sửa / khóa / phân công | [care-account.tsx](../apps/web/src/care-account.tsx) |
| GET | `/api/v1/admin/users/:id` | Tài khoản & nhân viên → Danh sách / chi tiết / tạo / sửa / khóa / phân công | [care-account.tsx](../apps/web/src/care-account.tsx) |
| POST | `/api/v1/admin/users` | Tài khoản & nhân viên → Danh sách / chi tiết / tạo / sửa / khóa / phân công | [care-account.tsx](../apps/web/src/care-account.tsx) |
| PUT | `/api/v1/admin/users/:id` | Tài khoản & nhân viên → Danh sách / chi tiết / tạo / sửa / khóa / phân công | [care-account.tsx](../apps/web/src/care-account.tsx) |
| DELETE | `/api/v1/admin/users/:id` | Tài khoản & nhân viên → Danh sách / chi tiết / tạo / sửa / khóa / phân công | [care-account.tsx](../apps/web/src/care-account.tsx) |
| PUT | `/api/v1/admin/users/:id/assign` | Tài khoản & nhân viên → Danh sách / chi tiết / tạo / sửa / khóa / phân công | [care-account.tsx](../apps/web/src/care-account.tsx) |
| POST | `/api/v1/roles` | Quản trị → Vai trò / Quyền hạn | [care-model.ts](../apps/web/src/care-model.ts), [care-ui.tsx](../apps/web/src/care-ui.tsx) |
| GET | `/api/v1/roles` | Quản trị → Vai trò / Quyền hạn | [care-model.ts](../apps/web/src/care-model.ts), [care-ui.tsx](../apps/web/src/care-ui.tsx) |
| POST | `/api/v1/permissions` | Quản trị → Vai trò / Quyền hạn | [care-model.ts](../apps/web/src/care-model.ts), [care-ui.tsx](../apps/web/src/care-ui.tsx) |
| GET | `/api/v1/permissions` | Quản trị → Vai trò / Quyền hạn | [care-model.ts](../apps/web/src/care-model.ts), [care-ui.tsx](../apps/web/src/care-ui.tsx) |
| PUT | `/api/v1/permissions/:id` | Quản trị → Vai trò / Quyền hạn | [care-model.ts](../apps/web/src/care-model.ts), [care-ui.tsx](../apps/web/src/care-ui.tsx) |
| DELETE | `/api/v1/permissions/:id` | Quản trị → Vai trò / Quyền hạn | [care-model.ts](../apps/web/src/care-model.ts), [care-ui.tsx](../apps/web/src/care-ui.tsx) |
| POST | `/api/v1/role_permissions` | Quản trị → Gán quyền cho vai trò | [care-account.tsx](../apps/web/src/care-account.tsx) |
| GET | `/api/v1/role_permissions/:role_id` | Quản trị → Gán quyền cho vai trò | [care-account.tsx](../apps/web/src/care-account.tsx) |
| DELETE | `/api/v1/role_permissions/:role_id/:permission_id` | Quản trị → Gán quyền cho vai trò | [care-account.tsx](../apps/web/src/care-account.tsx) |
| POST | `/api/v1/branches` | Cơ sở khám → Chi nhánh / Khoa phòng / Phòng khám | [care-model.ts](../apps/web/src/care-model.ts), [care-ui.tsx](../apps/web/src/care-ui.tsx) |
| GET | `/api/v1/branches` | Cơ sở khám → Chi nhánh / Khoa phòng / Phòng khám | [care-model.ts](../apps/web/src/care-model.ts), [care-ui.tsx](../apps/web/src/care-ui.tsx) |
| GET | `/api/v1/branches/:id` | Cơ sở khám → Chi nhánh / Khoa phòng / Phòng khám | [care-model.ts](../apps/web/src/care-model.ts), [care-ui.tsx](../apps/web/src/care-ui.tsx) |
| PUT | `/api/v1/branches/:id` | Cơ sở khám → Chi nhánh / Khoa phòng / Phòng khám | [care-model.ts](../apps/web/src/care-model.ts), [care-ui.tsx](../apps/web/src/care-ui.tsx) |
| DELETE | `/api/v1/branches/:id` | Cơ sở khám → Chi nhánh / Khoa phòng / Phòng khám | [care-model.ts](../apps/web/src/care-model.ts), [care-ui.tsx](../apps/web/src/care-ui.tsx) |
| POST | `/api/v1/departments` | Cơ sở khám → Chi nhánh / Khoa phòng / Phòng khám | [care-model.ts](../apps/web/src/care-model.ts), [care-ui.tsx](../apps/web/src/care-ui.tsx) |
| GET | `/api/v1/departments` | Cơ sở khám → Chi nhánh / Khoa phòng / Phòng khám | [care-model.ts](../apps/web/src/care-model.ts), [care-ui.tsx](../apps/web/src/care-ui.tsx) |
| GET | `/api/v1/departments/:id` | Cơ sở khám → Chi nhánh / Khoa phòng / Phòng khám | [care-model.ts](../apps/web/src/care-model.ts), [care-ui.tsx](../apps/web/src/care-ui.tsx) |
| PUT | `/api/v1/departments/:id` | Cơ sở khám → Chi nhánh / Khoa phòng / Phòng khám | [care-model.ts](../apps/web/src/care-model.ts), [care-ui.tsx](../apps/web/src/care-ui.tsx) |
| DELETE | `/api/v1/departments/:id` | Cơ sở khám → Chi nhánh / Khoa phòng / Phòng khám | [care-model.ts](../apps/web/src/care-model.ts), [care-ui.tsx](../apps/web/src/care-ui.tsx) |
| POST | `/api/v1/rooms` | Cơ sở khám → Chi nhánh / Khoa phòng / Phòng khám | [care-model.ts](../apps/web/src/care-model.ts), [care-ui.tsx](../apps/web/src/care-ui.tsx) |
| GET | `/api/v1/rooms` | Cơ sở khám → Chi nhánh / Khoa phòng / Phòng khám | [care-model.ts](../apps/web/src/care-model.ts), [care-ui.tsx](../apps/web/src/care-ui.tsx) |
| GET | `/api/v1/rooms/:id` | Cơ sở khám → Chi nhánh / Khoa phòng / Phòng khám | [care-model.ts](../apps/web/src/care-model.ts), [care-ui.tsx](../apps/web/src/care-ui.tsx) |
| PUT | `/api/v1/rooms/:id` | Cơ sở khám → Chi nhánh / Khoa phòng / Phòng khám | [care-model.ts](../apps/web/src/care-model.ts), [care-ui.tsx](../apps/web/src/care-ui.tsx) |
| DELETE | `/api/v1/rooms/:id` | Cơ sở khám → Chi nhánh / Khoa phòng / Phòng khám | [care-model.ts](../apps/web/src/care-model.ts), [care-ui.tsx](../apps/web/src/care-ui.tsx) |
| GET | `/api/v1/doctor/patients/search` | Bệnh nhân → Tìm / tiếp nhận | [care-clinical.tsx](../apps/web/src/care-clinical.tsx) |
| POST | `/api/v1/doctor/patients` | Bệnh nhân → Tìm / tiếp nhận | [care-clinical.tsx](../apps/web/src/care-clinical.tsx) |
| POST | `/api/v1/medical_records` | Hồ sơ khám → Tạo / chi tiết / lịch sử / tiếp nhận / chốt | [care-clinical.tsx](../apps/web/src/care-clinical.tsx) |
| GET | `/api/v1/medical_records/all` | Hồ sơ khám → Tạo / chi tiết / lịch sử / tiếp nhận / chốt | [care-clinical.tsx](../apps/web/src/care-clinical.tsx) |
| GET | `/api/v1/medical_records/:id` | Hồ sơ khám → Tạo / chi tiết / lịch sử / tiếp nhận / chốt | [care-clinical.tsx](../apps/web/src/care-clinical.tsx) |
| GET | `/api/v1/medical_records/:id/summary` | Hồ sơ khám → Tạo / chi tiết / lịch sử / tiếp nhận / chốt | [care-clinical.tsx](../apps/web/src/care-clinical.tsx) |
| GET | `/api/v1/medical_records/patients/:id/history` | Hồ sơ khám → Tạo / chi tiết / lịch sử / tiếp nhận / chốt | [care-clinical.tsx](../apps/web/src/care-clinical.tsx) |
| POST | `/api/v1/medical_records/:id/accept` | Hồ sơ khám → Tạo / chi tiết / lịch sử / tiếp nhận / chốt | [care-clinical.tsx](../apps/web/src/care-clinical.tsx) |
| PUT | `/api/v1/medical_records/:id` | Hồ sơ khám → Tạo / chi tiết / lịch sử / tiếp nhận / chốt | [care-clinical.tsx](../apps/web/src/care-clinical.tsx) |
| GET | `/api/v1/uas7-scores/eligibility` | Hôm nay / Hành trình bệnh nhân → Nhật ký UAS | [care-clinical.tsx](../apps/web/src/care-clinical.tsx) |
| POST | `/api/v1/uas7-scores` | Hôm nay / Hành trình bệnh nhân → Nhật ký UAS | [care-clinical.tsx](../apps/web/src/care-clinical.tsx) |
| GET | `/api/v1/uas7-scores/patient/:patient_id` | Hôm nay / Hành trình bệnh nhân → Nhật ký UAS | [care-clinical.tsx](../apps/web/src/care-clinical.tsx) |
| POST | `/api/v1/prescriptions` | Chi tiết hồ sơ → Kê đơn thuốc | [care-clinical.tsx](../apps/web/src/care-clinical.tsx) |
| GET | `/api/v1/lab-results/:record_id` | Chi tiết hồ sơ → Kết quả | [care-clinical.tsx](../apps/web/src/care-clinical.tsx) |
| POST | `/api/v1/image-attachments/upload` | Kho ảnh / Ảnh tiến triển → Upload / xem danh sách / xóa | [care-media.tsx](../apps/web/src/care-media.tsx) |
| GET | `/api/v1/image-attachments/user/:user_id` | Kho ảnh / Ảnh tiến triển → Upload / xem danh sách / xóa | [care-media.tsx](../apps/web/src/care-media.tsx) |
| DELETE | `/api/v1/image-attachments/:id` | Kho ảnh / Ảnh tiến triển → Upload / xem danh sách / xóa | [care-media.tsx](../apps/web/src/care-media.tsx) |
| POST | `/api/v1/lesion-episodes` | Tổn thương & ảnh → Đợt tổn thương | [care-media.tsx](../apps/web/src/care-media.tsx) |
| GET | `/api/v1/lesion-episodes/my` | Tổn thương & ảnh → Đợt tổn thương | [care-media.tsx](../apps/web/src/care-media.tsx) |
| GET | `/api/v1/lesion-episodes/:id` | Tổn thương & ảnh → Đợt tổn thương | [care-media.tsx](../apps/web/src/care-media.tsx) |
| PATCH | `/api/v1/lesion-episodes/:id` | Tổn thương & ảnh → Đợt tổn thương | [care-media.tsx](../apps/web/src/care-media.tsx) |
| DELETE | `/api/v1/lesion-episodes/:id` | Tổn thương & ảnh → Đợt tổn thương | [care-media.tsx](../apps/web/src/care-media.tsx) |
| POST | `/api/v1/lesion-locations` | Đợt tổn thương → Vị trí | [care-media.tsx](../apps/web/src/care-media.tsx) |
| GET | `/api/v1/lesion-locations/episode/:episode_id` | Đợt tổn thương → Vị trí | [care-media.tsx](../apps/web/src/care-media.tsx) |
| PATCH | `/api/v1/lesion-locations/:id` | Đợt tổn thương → Vị trí | [care-media.tsx](../apps/web/src/care-media.tsx) |
| DELETE | `/api/v1/lesion-locations/:id` | Đợt tổn thương → Vị trí | [care-media.tsx](../apps/web/src/care-media.tsx) |
| POST | `/api/v1/lesion-photos` | Vị trí → Ảnh tiến triển → Tạo / xem / đổi mốc / xóa | [care-media.tsx](../apps/web/src/care-media.tsx) |
| GET | `/api/v1/lesion-photos/location/:location_id` | Vị trí → Ảnh tiến triển → Tạo / xem / đổi mốc / xóa | [care-media.tsx](../apps/web/src/care-media.tsx) |
| PATCH | `/api/v1/lesion-photos/:id/milestone` | Vị trí → Ảnh tiến triển → Tạo / xem / đổi mốc / xóa | [care-media.tsx](../apps/web/src/care-media.tsx) |
| DELETE | `/api/v1/lesion-photos/:id` | Vị trí → Ảnh tiến triển → Tạo / xem / đổi mốc / xóa | [care-media.tsx](../apps/web/src/care-media.tsx) |

## API ngoài mẫu số 67

`GET /data/schema` phục vụ metadata; `/data/:table` phục vụ bệnh án chuyên sâu, đơn thuốc đã lưu và danh sách tổn thương của nhân viên. `GET /image-attachments/:id/content` phục vụ preview ảnh có xác thực; `POST /ai/analyze` phục vụ AI. Health và alias tương thích không cần màn hình nghiệp vụ riêng. 25 API chưa hỗ trợ vẫn được liệt kê trong [API_SPEC_MAPPING.md](API_SPEC_MAPPING.md); giao diện không tạo nút thực thi cho các chức năng này.
