# So sánh đếm từng nốt trên 63 ảnh

Ngày 2026-10-29. Đã thực hiện: rà trực quan 63 ảnh, tạo nhãn điểm tâm và box làm
việc, train YOLO baseline và model heatmap điểm tâm trên Colab T4, xuất so sánh.
Chưa đạt đếm chính xác; không thay model web đang chạy.

## Nhãn tham chiếu

582 đối tượng theo lượt rà trực quan của Codex, không sao chép dự đoán model làm
nhãn và không tiếp tục quy đổi mọi Multiple thành một đối tượng. Hai vùng còn
phân biệt được được gán riêng; vùng hợp lưu được gộp; vùng quá nhỏ/mờ hoặc cắt ở
mép ảnh không tính. Box xấp xỉ giới hạn vùng nhìn thấy, không phải mask.

Đây là nhãn làm việc, chưa được bác sĩ hoặc người dùng xác nhận độc lập. Đặc biệt
nhãn vùng hợp lưu, vùng rất nhỏ và điểm tâm vùng hình vòng còn chủ quan. Có 15
ảnh được gán không có nốt đủ điều kiện đếm: số 0 không có nghĩa da bình thường.
Các vùng loại toàn ảnh được lưu trong `excluded_regions`; pipeline hiện coi chúng
là ảnh không có mục tiêu đếm theo quy tắc, không phải spatial ignore mask trong
loss. Chưa có mask bỏ qua chi tiết cho từng vùng mờ trong ảnh có nhãn dương.

Giữ nguyên 8 validation, 10 test; bổ sung nhãn 11 ảnh cũ chưa nhãn vào train,
thành 45/8/10. Ảnh gốc giữ nguyên byte và kiểm tra SHA256. Không có mã bệnh nhân;
chưa chứng minh độc lập theo bệnh nhân hoặc loại hết ảnh gần giống. Người gán
nhãn đã xem kết quả lượt proxy trước trên các ID test này: đây không phải test
lâm sàng độc lập có làm mù. Nhãn được đóng gói cố định trước lượt train hiện tại.

## Hai phương pháp

- YOLOv8n pretrained COCO, 512 px, batch 8, tối đa 120 epoch, patience 25.
  Chạy 70 epoch, khoảng 1,20 phút. Checkpoint chọn theo validation detection
  fitness của Ultralytics; confidence 0,1 chọn theo MAE validation.
- Model điểm tâm tự triển khai: ResNet18 pretrained ImageNet + FPN stride 4,
  đầu ra heatmap 128x128, Gaussian target và focal loss, lấy cực đại cục bộ 3x3.
  Đây không phải bản triển khai P2PNet. Chạy 110 epoch, checkpoint epoch 70,
  khoảng 1,96 phút; chọn checkpoint/ngưỡng bằng validation MAE, hòa thì ưu tiên
  F1 vị trí. Confidence cuối 0,2.

Cả hai dùng cùng ảnh, điểm tâm tham chiếu, kích thước 512, seed 63042 và lưới
ngưỡng 0,1/0,15/0,2/0,25/0,3/0,4/0,5. Không dùng test để chọn ngưỡng. Pretraining,
augmentation và cách chọn checkpoint/ngân sách khác nhau; đây là so sánh hai
pipeline chạy một lần, không tách riêng tác động nhân quả của kiến trúc.
YOLO loại dự đoán box chạm mép; model điểm tâm học loại đối tượng mép bằng nhãn
âm, không có biên box để dùng cùng phép lọc. Đây cũng là khác biệt hậu xử lý.

## Kết quả cùng 10 ảnh test, 115 đối tượng tham chiếu

| Chỉ số | YOLO | Điểm tâm |
|---|---:|---:|
| MAE nốt/ảnh | 7,2 | 5,9 |
| RMSE | 11,28 | 9,30 |
| Đúng hoàn toàn | 0/10 | 2/10 |
| Lệch không quá 1 | 2/10 | 3/10 |
| Lệch không quá 2 | 4/10 | 4/10 |
| Tổng dự đoán | 53 | 72 |
| Điểm ghép đúng | 20 | 27 |
| Điểm nhận nhầm | 33 | 45 |
| Điểm bỏ sót | 95 | 88 |
| Precision vị trí | 37,74% | 37,50% |
| Recall vị trí | 17,39% | 23,48% |
| F1 vị trí | 23,81% | 28,88% |

Ghép một-một bằng khoảng cách điểm, bán kính 16 px trên ảnh chuẩn 512. Điểm dư
không được ghép lại cùng một nốt tham chiếu. Chênh MAE điểm tâm−YOLO = -1,3;
bootstrap cặp theo 10 ảnh, 5000 lần, khoảng percentile 95% [-3,7; 0,6]. Khoảng này
chứa 0 nên chưa đủ để khẳng định phương pháp điểm tâm tốt hơn ổn định.

Đối chứng không nhìn ảnh: luôn 0 MAE 11,5; luôn trung vị train (3) MAE 9,7.
Cả hai lượt train tốt hơn các đối chứng đếm này nhưng độ chính xác tuyệt đối
và định vị vẫn thấp.

| ID | Nhãn mới | YOLO | Điểm tâm |
|---|---:|---:|---:|
|7|10|7|6|
|17|1|0|1|
|26|40|13|15|
|30|3|2|5|
|35|2|0|2|
|38|23|18|15|
|41|8|1|5|
|52|23|2|12|
|58|0|2|1|
|95|5|8|10|

Đã kiểm tra ảnh so sánh: ở 17, model điểm tâm đếm đúng tổng 1 nhưng vị trí lệch
khỏi tâm vùng tham chiếu. 26 và 52 vẫn bỏ sót nhiều; 95 cả hai đếm dư so với
nhãn vùng hợp lưu. Vì vậy không coi 2/10 đếm đúng là 2 ảnh nhận diện mọi nốt đúng.
Không so MAE ở đây với 7,6 lượt trước để tuyên bố cải thiện: ảnh test cùng ID
nhưng nhãn tham chiếu, số ảnh train, kích thước và cấu hình đã thay đổi.

## Kiểm tra và bước tiếp

5 unit test qua: hai đỉnh riêng, nền không sinh điểm, đếm đúng nhưng sai vị trí,
ghép một-một không đếm trùng, target/loss backward hữu hạn và kích thước output.
Đã kiểm tra đủ 63 cặp ảnh/nhãn, số dòng box khớp điểm, test/validation ID không đổi,
hash ảnh và gói zip tải từ Colab; đây không thay thế xác nhận nhãn chuyên môn.

Trước lượt mở rộng, ưu tiên một người rà độc lập nhãn điểm tâm/hợp lưu, đặc biệt
15 ảnh số 0 và các ảnh dày 119/128/150. Sau đó tạo test mới chưa từng dùng trong
phát triển. Prototype điểm tâm có dấu hiệu đáng thử tiếp, chưa nên thay model
đang phục vụ hoặc mở rộng nhãn tự động bằng dự đoán hiện tại.

## Đường dẫn

- `.data/ml/counting63-instance-v1/index.html`: ảnh gốc cạnh nhãn 63 ảnh.
- `annotations.visual.json`: nhãn Codex, chưa được xác nhận độc lập.
- `MayDay_counting63_instances.zip`: dataset train cho hai phương pháp.
- `comparison/index.html`: bảng kết quả và ba cột tham chiếu/YOLO/điểm tâm.
- `comparison/comparison-report.json`: số liệu, dự đoán, ngưỡng validation, giới hạn.
- `comparison/yolo/weights/best.pt`: SHA256
  `925750033bc673e6cb8d8184f3587fca3a4662458c89aa76655c01a86eaf886f`.
- `comparison/point-best.pt`: SHA256
  `8af0941f780ecca77ad1e9ef0b9fcdd000cd81de1c7d5aae37059ac8332714d9`.
- ZIP đầu vào SHA256
  `40603507ab532567aab38983af53c198572bc47103770c4aa37ff70d3385552c`.
