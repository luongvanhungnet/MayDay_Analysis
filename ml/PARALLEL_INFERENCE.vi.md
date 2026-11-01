# Chạy hai model trong MayDay

Đăng nhập ứng dụng, chọn **Phân tích ảnh AI**, chọn JPEG/PNG/WebP tối đa 8 MiB
và 16 triệu pixel. API `POST /api/v1/ai/analyze` dùng multipart field `image`,
yêu cầu Bearer session giống các API riêng tư khác.

Hai tiến trình Python CPU được khởi chạy đồng thời, mỗi tiến trình sở hữu một model
và dùng một torch thread. Chỉ nhận một ảnh tại một thời điểm để giới hạn RAM.
Các model được nạp lại cho mỗi ảnh; đây là bản triển khai local, có chi phí khởi
động. Timeout mỗi worker là 120 giây. Lỗi một worker làm cả yêu cầu thất bại;
không diễn giải lỗi hoặc không phát hiện được thành kết luận da bình thường.

Model cố định:

- `.data/ml/yolov8n_20261028_164928/weights/best.pt`: Body/Multiple/Single.
- `.data/ml/v4_two_class_20261029/weights/best.pt`: normal skin/urticaria.

Kết quả có `models[].detections[]` gồm label, confidence và xyxy theo pixel trên
ảnh đã xoay đúng EXIF; width/height đi kèm. Confidence dùng riêng, không trung bình.
`conflicting` khi normal skin cùng xuất hiện với urticaria hoặc Single/Multiple;
`concordant` khi cả urticaria và Single/Multiple cùng xuất hiện; các trường hợp khác
là `uncertain`. Đây là quy tắc so sánh ở mức ảnh, không phải kiểm định lâm sàng hay
đối chiếu IoU giữa hai bộ nhãn. Ngưỡng 0,25 chưa được hiệu chuẩn cho triển khai.

Ảnh chỉ đi qua RAM/stdin local; không lưu ảnh, kết quả hoặc sửa database. Chọn lại
ảnh sẽ xóa kết quả cũ trên giao diện. Không đếm box thành số nốt/AUAS.

## Cài môi trường (từ thư mục gốc)

```powershell
uv venv .data/ai-venv --python 3.11
uv pip install --python .data/ai-venv/Scripts/python.exe torch torchvision --index-url https://download.pytorch.org/whl/cpu
uv pip install --python .data/ai-venv/Scripts/python.exe -r ml/requirements-inference.txt
npm run dev
```

API tự tìm `.data/ai-venv/Scripts/python.exe` trên Windows hoặc `bin/python` trên
Linux. Có thể cấu hình `AI_PYTHON` thành đường dẫn tuyệt đối tới interpreter khác.
Model không nằm trong Git; cần sao chép hai checkpoint tin cậy vào các vị trí trên
khi chuyển máy. Không dùng checkpoint không rõ nguồn gốc.

## Bằng chứng local 2026-10-29

- Build và typecheck API/web đạt; 8 unit tests đạt, 1 DB integration test bỏ qua do
  không cấu hình database test trong lượt này.
- Hai checkpoint thật chạy cùng một ảnh JPEG: lesions trả 55 vùng, skin trả 1 vùng;
  kết quả conflicting. Đây là kiểm tra chức năng, không phải xác nhận nhãn đúng.
- Lượt khởi động đầu khoảng 30,3 giây; lượt sau qua multipart HTTP khoảng 3,9 giây.
  Không phải benchmark đại diện nhiều ảnh hay thời gian bảo đảm.
- HTTP trên server test loopback tạm dùng NativeGuard với authenticator giả lập
  (không truy cập DB): không token 401, không ảnh 400, ảnh hợp lệ 201 và đủ hai model.
- Kiểm tra chặn yêu cầu thứ hai khi đang bận đạt.
- Evidence local: `.data/ml/parallel-inference-verification.json` và
  `.data/ml/parallel-http-verification.json`. Chưa xác minh trực quan UI trong phiên đăng nhập thật.
