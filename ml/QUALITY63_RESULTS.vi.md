# Thử nghiệm 63 ảnh chọn lọc — 2026-10-29

Đã chạy thật trên Colab Tesla T4, Ultralytics 8.3.221, YOLOv8n pretrained COCO.
56 epoch, khoảng 0,985 phút; checkpoint tốt nhất theo validation, dừng sớm patience 25.
Không thay model đang phục vụ trên web.

## Dữ liệu và giới hạn

63 ảnh có mặt trong gói: 34 train (501 box), 8 validation (131 box), 10 test
(142 box), 11 chưa có nhãn từng nốt chỉ chạy inference. Không gọi đây là 63 ảnh
huấn luyện có giám sát. Seed 63042; ảnh giữ nguyên byte, SHA256 và tên nhóm nguồn
không trùng. Chưa kiểm chứng tách bệnh nhân hoặc tất cả ảnh gần giống.

Nhãn nguồn Single và Multiple chuyển thành một lớp wheal; mỗi Multiple vẫn là
một vùng tham chiếu, chưa xác nhận tách/chạm/hợp lưu. Loại box chạm biên <=1 px
và cạnh ngắn <5 px là heuristic. 242 vùng Multiple trong toàn bộ tập nhãn quy đổi.
Vì vậy các chỉ số dưới đây đánh giá nhãn quy đổi, không chứng minh độ chính xác
đếm nốt thật theo quy tắc người dùng. 11 ảnh thiếu nhãn không bị coi là ảnh âm tính.

## Kết quả test

Confidence 0,4 được chọn bằng MAE trên 8 ảnh validation, không chọn bằng test.

| Chỉ số trên 10 ảnh test | Giá trị |
|---|---:|
| MAE so với nhãn quy đổi | 7,6 vùng/ảnh |
| RMSE | 10,315 |
| Sai lệch có dấu trung bình | -2,4 |
| Đúng hoàn toàn | 0/10 |
| Sai không quá 1 | 3/10 |
| Sai không quá 2 | 4/10 |
| Đếm dư / thiếu | 6 / 4 ảnh |
| Tổng tham chiếu / dự đoán | 142 / 118 |
| Precision / recall detection | 62,13% / 44,37% |
| mAP50 / mAP50–95 detection | 45,91% / 22,33% |

Precision/recall ở operating point của Ultralytics validation; không đồng nhất với
ngưỡng confidence 0,4 dùng để đếm. Ở confidence cố định 0,25: MAE 8,7, tổng 179,
đúng hoàn toàn 1/10. Chỉ thay ngưỡng không giải quyết được vấn đề tổng thể.

| Ảnh | Nhãn quy đổi | Dự đoán | Lệch |
|---|---:|---:|---:|
|007|8|9|+1|
|017|5|6|+1|
|026|35|21|-14|
|030|3|4|+1|
|035|4|2|-2|
|038|31|34|+3|
|041|17|6|-11|
|052|31|8|-23|
|058|0|11|+11|
|095|8|17|+9|

## Nhận xét qua ảnh dự đoán

Contact sheet test đã được xem: ảnh 017 có box lớn bao quanh các box nhỏ, gây đếm
trùng; ảnh 026, 041, 052 bỏ sót nhiều so với nhãn; 058 phát hiện cả vùng gần ngón
tay/viên đá và da đỏ không tách rõ. Số tham chiếu 0 ở 058 chỉ là không còn box sau
quy đổi/lọc, không có nghĩa da bình thường. 095 có vùng lớn và nhỏ chồng nhau.
Ngay cả ảnh có tổng gần đúng như 038 vẫn có thể vừa bỏ sót vừa đếm dư.

Kết quả chưa đạt mục tiêu đếm chính xác. Ảnh nét hơn không tự sửa được nhãn đếm.
Bước có ích nhất là gán lại điểm tâm/box từng nốt cho toàn bộ tập, xử lý vùng
chạm/hợp lưu và vùng bỏ qua rõ ràng, bổ sung nhãn cho 11 ảnh. Khóa test có số đếm
được xác nhận trước khi thử mô hình khác. Có thể thử segmentation từng instance
sau khi có mask thật; không sinh mask giả từ box.

Không so MAE 7,6 với MAE 2,2 của pilot50 để kết luận tiến/lùi: khác test, khác độ
dày tổn thương. Test hiện tại chỉ 10 ảnh, chưa đủ cho khẳng định tổng quát.

## Artifact

- `.data/ml/quality63-experiment/MayDay_quality63_experiment.zip`
  SHA256 `b1a8d7b12ae80ce102cbe91be0980ede2a39610a0d55590d5057eec1d48824d8`.
- `.data/ml/quality63-experiment/model/weights/best.pt`
  SHA256 `41176edd770865a8a7f32ad25287feec3891490038ca63c1f2a9738e9032008b`.
- `model/training-report.json`: ngưỡng validation, kết quả từng ảnh, tọa độ/confidence.
- `model/index.html`: ảnh gốc và ảnh đánh số 10 test + 11 ảnh chưa nhãn.
- `model/test-count-contact.jpg`: tổng quan test.
- `ml/build_quality63_experiment.py`, `ml/train_quality63.py`,
  `ml/render_quality63_report.py`: script tái lập.
