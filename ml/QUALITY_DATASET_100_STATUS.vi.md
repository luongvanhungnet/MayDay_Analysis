# Trạng thái yêu cầu dataset đếm 100 ảnh chất lượng

2026-10-29. Yêu cầu chưa hoàn tất; chưa train lượt mới, không thay model trên web.

## Đã làm

Kiểm tra toàn bộ hai ZIP: v2 có 100 nhóm tên ảnh nguồn ở 480x480; v4 có 230 file
nhưng 51 nhóm tên nguồn ở 512x512. Nhóm tên nguồn không tương đương nhóm bệnh nhân.
Kiểm tra 151 đại diện qua 13 contact sheets, rà soát ảnh ghép, nhòe, thiếu chi tiết,
ánh sáng, nét vẽ và các nguồn giống nhau. 126 ảnh vượt bộ lọc số học nhưng chỉ 63
được đưa vào shortlist sau xem tổng quan: 52 v2, 11 v4. Shortlist chưa phải chứng
nhận ảnh đạt ở độ phân giải gốc hoặc nhãn đếm đúng. Không phóng to/augment để bù 100.

Ngưỡng số học: cạnh ngắn >=480; Laplacian variance trên ảnh xám 256x256 >=35;
p95-p5 >=45; độ sáng trung bình 40..220; tỷ lệ pixel gần đen/trắng <=0,4.
Đây là ngưỡng sàng lọc kỹ thuật, không bảo đảm nhìn rõ tổn thương. Nhóm ảnh ít chi
 tiết tự nhiên có thể bị loại nhầm, nên báo cáo giữ cả ảnh và lý do để xem lại.

## Đầu ra

- `.data/ml/quality-audit-100-target/index.html`: xem 151 ảnh với quyết định/lý do.
- `quality-audit.json`: nguồn, checksum, chỉ số và quyết định của từng ảnh.
- `decisions.csv`: bảng xuất để đối chiếu.
- `shortlist/`: 63 ứng viên, chưa chia tập hoặc train.
- `ml/audit_counting_image_quality.py`: tái tạo sàng lọc số học và contact sheets.

## Điều kiện còn thiếu

Cần ít nhất 37 ảnh mới đáp ứng tiêu chí sau duyệt để đủ 100. Số cần thu thập thực
tế lớn hơn 37 vì có ảnh sẽ bị loại. 11 ảnh v4 chưa có nhãn từng nốt; 52 ảnh v2 chỉ
có nhãn cũ, vẫn chưa giải quyết triệt để tách/chạm/hợp lưu theo quy tắc đếm mới.
Không thể báo MAE số nốt thật bằng cách lấy dự đoán model cũ làm nhãn test.

Nguồn bổ sung có thể khai thác là SCIN (Google), nhưng phải lọc ảnh, kiểm tra giấy
phép và gán nhãn từng nốt; nhãn bệnh ở cấp ảnh không thay thế nhãn đếm. DermoPed
có crop 256x256 nên không phải lựa chọn mặc định để đạt mục tiêu ảnh gốc rõ hơn.

Sau khi đủ dữ liệu: xác minh nhóm nguồn/bệnh nhân, chia train/validation/test theo
nhóm, khóa test mới và train từ pretrained tổng quát. Báo MAE đếm, đếm dư/thiếu,
đúng hoàn toàn/±1/±2 và độ không chắc chắn trên ảnh khó. So sánh model cũ và mới
trên cùng test độc lập; không dùng mAP khác test để khẳng định tốt hơn.
