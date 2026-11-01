# Triển khai theo mayday_backup.sql

Xem README.md ở thư mục gốc để chạy ứng dụng, chính sách quyền và giới hạn hiện tại.

Nguồn schema: PostgreSQL 17, 44 bảng và view v_chukytheodoiuas7. File backup được import nguyên trạng; code không thêm bảng/cột/view/trigger hoặc migration. Prisma introspection giữ các ràng buộc phức hợp và kiểu interval; phía API đọc interval bằng text và khóa GENERATED chỉ đọc. Sáu quan hệ đảo subtype được mô hình một-nhiều trong Prisma để phù hợp khóa ngoại phức hợp, không thêm unique constraint vào database.

API native nằm tại apps/api/src/native. Metadata từ schema.json là danh sách cho phép tên bảng/cột; tên nhận từ HTTP phải khớp metadata. Mọi giá trị SQL được truyền qua Prisma.sql, không nối nội dung người dùng thành SQL. API liệt kê/chi tiết không chọn cột mat_khau_ma_hoa. Không gửi mật khẩu hay hash xuống frontend.

GET /data/schema trả schema theo vai trò. GET /data/:table có page, limit, search, filter JSON. POST /data/:table tạo dữ liệu. PATCH /data/:table/:key cập nhật theo khóa chính JSON được URL-encode. API bảo toàn khóa chính ghép (vaitroquyenhan) và không đổi chủ sở hữu hồ sơ khi sửa. DELETE chỉ cho admin xóa danh mục; khóa ngoại ngăn xóa danh mục đang được sử dụng. Hồ sơ lâm sàng được giữ lại.

Hồ sơ CAP/MAN, phiên khám CAP/MAN và kết quả cận lâm sàng có subtype tạo cùng transaction. Quyền bệnh nhân áp dụng ở SQL bằng đường liên kết FK tới benhnhan, bao gồm đơn thuốc và các chi tiết. Khi ghi nhật ký/tổn thương, FK được kiểm tra trong transaction để ngăn gắn hồ sơ của người khác.

Phiên đăng nhập lưu token băm, mã tài khoản, dấu vân tay mật khẩu/người/vai trò và thời hạn tại SESSION_FILE. Không có thay đổi database cho quản lý phiên. Phiên đăng nhập local một tiến trình, không phải cơ chế phân tán.

Bằng chứng kiểm thử: database-verification.json (HTTP trên database tạm), database-import-verification.json (đối chiếu dữ liệu import với bản restore độc lập). Dữ liệu giả chỉ được ghi ở database kiểm thử. Không kiểm chứng lưu trữ ảnh gốc vì file SQL không mang dữ liệu file ảnh.
