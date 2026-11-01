# Giao diện cho 67 API đã ánh xạ

Giao diện giữ phong cách MayDay hiện có, thay các màn hình sửa bảng của luồng chính bằng màn hình nghiệp vụ. Các chức năng chưa hỗ trợ trong [bảng đối chiếu backend](API_SPEC_MAPPING.md) không có nút thực thi trên web. Quên mật khẩu hướng dẫn liên hệ quản trị viên; không tạo quy trình khôi phục giả.

| Nhóm màn hình | Số API nghiệp vụ | Thao tác |
|---|---:|---|
| Tài khoản và hồ sơ | 7 | Đăng ký bệnh nhân, đăng nhập, đăng xuất, đổi mật khẩu bằng PUT, đọc/sửa hồ sơ và tạo nhân viên |
| Quản trị | 15 | Danh sách/chi tiết/tạo/sửa/khóa tài khoản, phân công chi nhánh; tạo/xem vai trò; CRUD quyền; xem/cấp/thu hồi quyền theo vai trò |
| Cơ sở | 15 | CRUD chi nhánh, khoa phòng, phòng khám; chỉ admin sửa/xóa |
| Tiếp nhận bệnh nhân | 2 | Tìm tên/số điện thoại, tạo người và bệnh nhân |
| Hồ sơ khám | 7 | Tạo, liệt kê, chi tiết, tóm tắt, lịch sử bệnh nhân, tiếp nhận và chốt |
| Nhật ký UAS | 3 | Kiểm tra điều kiện, ghi điểm hôm nay, xem lịch sử |
| Điều trị / xét nghiệm | 2 | Kê đơn nhiều thuốc và đọc kết quả cận lâm sàng |
| Kho ảnh | 3 | Upload multipart, danh sách theo người tải, xóa tệp chưa bị tham chiếu |
| Tổn thương da | 13 | CRUD đợt và vị trí; tạo/xem/xóa ảnh tiến triển, đổi mốc start/peak/normal |
| **Tổng** | **67** | |

## Quy tắc giao diện

- Menu theo vai trò; đường dẫn quản trị trực tiếp cũng bị chặn cho bệnh nhân trước khi gọi dữ liệu. Server vẫn là nơi kiểm tra quyền cuối cùng.
- Tiếp nhận chỉ xuất hiện cho bác sĩ/quản trị khi hồ sơ pending. Kê đơn/chốt chỉ xuất hiện khi in_progress và bác sĩ hiện tại trùng bác sĩ phụ trách phiên khám mới nhất. Không có nút xóa bệnh án.
- Bệnh nhân không nhập patient_id khi tạo bệnh án/ghi UAS. Điểm tổng do server tính; web chỉ gửi hai điểm nguyên 0–3.
- Khóa tài khoản có xác nhận và giữ hồ sơ. Vai trò không có cấu trúc cha/con; không có tùy chọn phân công khoa/phòng cho nhân viên khi backend chưa hỗ trợ.
- Quản trị có thể cấp tài khoản cho bệnh nhân đã tiếp nhận, dùng POST `/data/taikhoan` liên kết mã người hiện có và vai trò bệnh nhân. Luồng này không tạo lại nguoi/benhnhan, tránh tách lịch sử khám khỏi tài khoản mới; người đã có tài khoản bị ràng buộc unique của database từ chối.
- Lựa chọn bệnh nhân, vai trò và cơ sở lấy từ server, có tìm kiếm/tải thêm. Danh sách dài có phân trang. Người chăm sóc chọn bệnh nhân để đọc nhật ký và tổn thương.
- Ảnh riêng tư được fetch với Bearer token và hiển thị bằng blob URL; thu hồi URL khi đóng. Không dùng trực tiếp URL nội dung không có Authorization. Có upload giới hạn MIME/kích thước phía client; server kiểm tra nội dung và quyền.
- Các mốc thời gian mới chuyển từ giờ local thành ISO có múi giờ; không làm tròn mất giây khi lưu trường ngày giờ không được thay đổi. ID bigint giữ dạng chuỗi.
- Hộp xác nhận nằm trong ứng dụng. Modal hiển thị bằng portal, giữ focus, hỗ trợ Escape/Tab và khôi phục focus khi đóng biểu mẫu con.
- Bookmark `?table=...` của các bảng chính chuyển sang luồng mới; menu dùng `?view=...`. Các màn hình lâm sàng chi tiết chưa có API tương ứng vẫn nằm trong mục Hồ sơ chuyên sâu.
- Đọc metadata và các màn hình chuyên sâu tiếp tục dùng `/data`. Với nhân viên xem các đợt tổn thương của bệnh nhân, danh sách dùng GET `/data/dottonthuongda` có bộ lọc bệnh nhân do nhóm API mới chỉ có danh sách `/lesion-episodes/my`; các thao tác chi tiết/sửa/xóa vẫn dùng API mới.

## Kiểm tra

- Unit tests: quyền thao tác bệnh án, payload không gửi trường thừa, bảo toàn bigint, giới hạn điểm, múi giờ và bookmark cũ.
- Kiểm thử React DOM với request giả lập: nhận ca có xác nhận rồi mở kê đơn; Escape đóng biểu mẫu con và giữ hồ sơ; gửi UAS đúng dữ liệu; chặn trang quản trị cho bệnh nhân; upload FormData đúng hồ sơ. Đây không thay cho kiểm thử browser với server thật.
- Kiểm thử backend HTTP: `npm run test:spec` chạy đủ 67 API trên database schema-only tạm và xác nhận 25 giới hạn schema; kết quả lưu riêng ở `spec-api-test-results.json`.
- Đã quan sát trang đăng nhập, danh sách và chi tiết hồ sơ trên trình duyệt với dữ liệu fixture. Kiểm tra trình duyệt đầy đủ sau chỉnh sửa và kiểm tra thiết bị di động chưa hoàn tất: hộp confirm cũ làm phiên điều khiển trình duyệt bị kẹt. Không coi build hoặc kiểm thử DOM là bằng chứng đã kiểm tra đầy đủ responsive/browser.
- `SPEC_WEB_PREVIEW=1 node scripts/spec-smoke.mjs` tạo thêm server Vite cổng 5175 sau bộ kiểm thử backend, dùng database tạm. Tệp `.data/web-preview.json` chứa đường dẫn stopFile; tạo tệp đó để dừng server và xóa database kiểm thử. Không dùng tài khoản hoặc dữ liệu người dùng thật.

Chạy lại `npm test`, `npm run typecheck`, `npm run build` trước khi tích hợp.
