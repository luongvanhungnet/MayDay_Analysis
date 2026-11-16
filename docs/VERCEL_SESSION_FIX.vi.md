# Sửa lỗi 3003 ngay sau đăng nhập trên Vercel

Request `GET /api/v1/data/schema` đã gửi Bearer token nhưng trả 401. Trước đây, backend chỉ tra token trong bộ nhớ của `NativeService`, đồng thời lưu bản sao tại `/tmp/sessions.json` trên Vercel. Instance khác hoặc cold start không có bản sao này, nên không nhận ra token vừa được cấp. Vercel hướng dẫn dùng kho phiên Redis dùng chung: https://vercel.com/kb/guide/session-store-nextjs-redis-vercel-kv.

## Cấu hình project API

Áp dụng cho project phục vụ `https://may-day-analysis-4fzt.vercel.app`, không chỉ project frontend `https://may-day-analysis.vercel.app`.

1. Kết nối một Redis dùng chung vào project API, ví dụ Upstash Redis qua Vercel Marketplace. Không dùng Redis localhost trên Vercel.
2. Đặt các biến ở environment đang triển khai, thường là Production:

   ```dotenv
   SESSION_STORE=redis
   UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your-write-enabled-token
   ```

   Cặp `KV_REST_API_URL` + `KV_REST_API_TOKEN` cũng được nhận. Hoặc dùng `REDIS_URL=rediss://...` với dịch vụ Redis TCP. Cặp REST có ưu tiên khi được cấu hình. Giữ URL/token ở Environment Variables của API; không đưa vào biến `VITE_*` hoặc repository. Nếu dùng chung Redis cho nhiều môi trường, đặt `SESSION_KEY_PREFIX` khác nhau, ví dụ `mayday:production:session:v1:` và `mayday:preview:session:v1:`.
3. Redeploy API với code và environment mới; redeploy frontend để nhận bản sửa xử lý 401 về chậm. Đăng nhập lại để lấy token mới. Token Vercel cũ trong `/tmp` không được chuyển sang Redis.

Không cần migration hay thay đổi dữ liệu 44 bảng hiện tại. Đặt thêm `SESSION_FILE` trên Vercel không khắc phục được vấn đề nhiều instance.

## Hành vi sau sửa

- Login chỉ trả thành công sau khi lưu phiên vào Redis; lưu khóa theo SHA-256 của token và đặt TTL 2 giờ. Không lưu token gốc.
- Mỗi lần xác thực đọc kho phiên dùng chung, rồi kiểm tra lại trạng thái tài khoản và fingerprint mật khẩu/vai trò trong database.
- Logout xóa khóa Redis, có hiệu lực trên mọi instance. Không cache bản sao phiên trong RAM để tránh chấp nhận token đã thu hồi.
- Thiếu cấu hình hoặc Redis lỗi trả 503 thay vì phát token tạm rồi báo hết hạn ở request tiếp theo. Không tự chuyển về `/tmp` khi Redis lỗi.
- Bootstrap NestJS trên cùng instance dùng chung một promise khi nhiều request cold start đến đồng thời.
- Response API và lỗi xác thực có `Cache-Control: private, no-store`.
- Frontend chỉ xóa phiên nếu 401 thuộc token đang dùng; response cũ không xóa phiên mới vừa đăng nhập.

## Xác minh

```powershell
npm run typecheck
npm test
npm run build
```

Các test mới dùng database/Redis giả lập, không cần hoặc ghi dữ liệu production: login ở instance A, xác thực và đọc schema ở B và sau cold start; logout liên instance; hết hạn; đổi vai trò/khóa tài khoản; kho phiên lỗi hoặc thiếu cấu hình; tương thích file local; 401 JSON/ảnh cũ không xóa phiên mới.

Sau redeploy, kiểm tra bằng tài khoản của bạn: login thành công; `/api/v1/data/schema` và `/api/v1/profile` trả 200 với cùng Bearer; tải lại trang vẫn đăng nhập; logout rồi gọi lại token cũ nhận 401. Không đưa token vào ảnh chụp hoặc log chia sẻ.

Bản sửa trong repository không tự tạo Redis, đổi Environment Variables hoặc deploy lên tài khoản Vercel. Các bước cấu hình/redeploy trên vẫn cần được thực hiện để sửa bản đang chạy.
