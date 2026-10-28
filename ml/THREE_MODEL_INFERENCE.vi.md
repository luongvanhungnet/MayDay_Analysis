# Ba model local — 2026-10-29

API multipart `POST /api/v1/ai/analyze` nay khởi chạy đồng thời ba worker CPU:

1. lesions: Body/Multiple/Single, checkpoint cũ được giữ nguyên.
2. skin: normal skin/urticaria, checkpoint v4 giữ nguyên.
3. counting: wheal, checkpoint `.data/ml/counting_pilot_50/weights/best.pt`.

Dùng cùng Python venv và giới hạn upload như `PARALLEL_INFERENCE.vi.md`.
Ba model có thể dùng thêm RAM; chỉ một yêu cầu phân tích được chạy cùng lúc.
Lỗi bất kỳ model nào làm cả yêu cầu thất bại, không trả số đếm giả.

Model counting được train từ 50 ảnh theo yêu cầu duyệt mặc định của người dùng.
Nhãn là proxy: 501 Single giữ lại, 199 Multiple coi mỗi vùng là một đối tượng,
89 ứng viên mép/nhỏ bị loại. Chưa giải quyết được mọi cặp nốt chạm nhau, ranh giới
hợp lưu và độ rõ. `count_verified` không được gán thành số chuẩn chuyên gia.
Không có instance mask; model hiện tại là YOLO detection một lớp.

Đếm inference: chỉ đếm khung confidence >=0,25, không sát mép 1 pixel và cả hai
cạnh >=5 pixel trên ảnh đã xoay EXIF. Đây là ngưỡng kỹ thuật chưa được hiệu chuẩn
cho ảnh khác kích thước/khoảng cách. Không suy ra được kích thước vật lý, độ rõ
hoặc chắc chắn nốt có bị cắt khỏi ảnh hay không chỉ từ bbox.

Trạng thái đồng thuận/mâu thuẫn hiện vẫn so sánh lesions và skin ở mức ảnh;
counting trả số xấp xỉ độc lập, không đóng vai trò phiếu biểu quyết. Không cộng
confidence, không cộng số box ba model. Không tự lưu ảnh/kết quả hoặc sửa database.

Mở rộng tất cả ảnh chỉ sau khi có đánh giá đếm đáng tin cậy; proxy MAE trên 5 ảnh
không phải bằng chứng đủ để tự mở rộng. Hướng dẫn cũ giữ lịch sử pilot chưa duyệt;
manifest trong gói approved ghi nhận riêng yêu cầu duyệt mặc định sau đó.

## Kết quả pilot đã chạy

Train trên Colab T4 khoảng 1,60 phút. Tập test 5 ảnh / 36 đối tượng nhãn xấp xỉ:
mAP50 0,4236, mAP50–95 0,2735, precision 0,6424, recall 0,3611.
MAE so với số đếm proxy là 2,2 đối tượng/ảnh; không phải sai số so với số nốt thật.
Model chưa đủ cơ sở mở rộng tự động. Checkpoint được tải về máy, xác minh SHA256
b9d070a32970b0bd47c08a010d241ad5630cfc6a0c75361ff9529005b430feb4.

Build, typecheck, 9 unit tests đạt (1 DB integration test bỏ qua). HTTP loopback với
NativeGuard/authenticator test: 401 không token, 400 không ảnh, 201 với JPEG và đủ
ba kết quả. Lượt đo HTTP ~8,46 giây, không phải benchmark nhiều ảnh.
Báo cáo `.data/ml/counting_pilot_50/training-report.json`; evidence transport
`.data/ml/three-model-http-verification.json`.

Đã kiểm tra trực quan trên web local đang đăng nhập: 3 cột kết quả, model đếm trả
44 đối tượng trên ảnh thử; lượt web ~4,7 giây. Ảnh này chỉ kiểm tra chức năng, không
được xem là bằng chứng đếm đúng. Screenshot: `.data/ml/counting_pilot_50/three-model-web.png`.
