# MayDay — Thử nghiệm dataset đếm 50 ảnh

Ngày tạo: 2026-10-29. Trạng thái: DRAFT_NOT_TRAIN_READY.

## Quy tắc người dùng đã chốt

- Hai nốt chạm nhau nhưng còn phân biệt được: 2 đối tượng.
- Hợp lưu không còn ranh giới rõ: 1 đối tượng.
- Nốt bị cắt ở mép ảnh: không tính.
- Nốt quá nhỏ hoặc không rõ: không tính.

Các tiêu chí này là quy tắc đếm của dự án, không thay thế xác nhận bệnh da.
Mốc dưới 5 pixel và sát mép 1 pixel chỉ dùng gắn cờ ban đầu; không được coi là
ngưỡng lâm sàng hoặc tiêu chuẩn kích thước người dùng đã xác nhận.

## Bản đã tạo

Thư mục `.data/ml/counting-pilot-50/dataset` chứa 50 ảnh gốc không chỉnh sửa,
`annotations.draft.json`, `validation.json`, và `index.html` để chỉnh điểm đếm.
ZIP `.data/ml/counting-pilot-50/MayDay_counting_pilot_50_DRAFT.zip` có thể chuyển máy.

50 ảnh được chọn ngẫu nhiên seed 42 trong train cũ (35 train, 10 validation, 5 test
đề xuất). Không đụng ảnh valid/test cũ. Model cũ đã học các ảnh này, do đó không
được dùng model cũ so với nhãn mới để tuyên bố độ chính xác độc lập. Các tập đề xuất
chưa xác minh phân nhóm bệnh nhân hoặc ảnh tương tự về thị giác; 50 tên nguồn khác
nhau chỉ loại rò rỉ do trùng tên, không đủ chứng minh 50 người khác nhau.

Khởi tạo 501 điểm từ tâm nhãn Single, không coi là được Codex xác nhận từng nốt.
199 Multiple chưa giải quyết: không tự đổi thành 1 nốt. 89 nhãn bị gắn cờ mép/nhỏ
được giữ lại để duyệt, không bị xóa khỏi nguồn. Không tạo mask giả từ box.
Tất cả `count_verified` hiện null; không được dùng 501 làm tổng nốt chuẩn.
Đã xem tổng quan 50 ảnh qua contact sheets, chưa hoàn tất gán lại từng đối tượng.
Một số ảnh ghép, nhiều vùng hợp lưu, ảnh mờ/độ phân giải thấp cần xử lý riêng.

## Công cụ hoàn thiện nhãn

Mở index.html trực tiếp: chọn ảnh, thêm một điểm cho mỗi nốt được tính, bấm điểm
để xóa; mỗi vùng Multiple có nút xác nhận đã xử lý sau khi thêm đủ điểm hoặc
quyết định loại vùng không rõ. Duyệt các cờ loại bỏ trước khi đánh dấu ảnh reviewed.
Tải JSON để lưu tiến độ, nạp lại JSON ở lần sau. Không đóng tab trước khi tải JSON;
trang không tự ghi file hoặc gửi ảnh lên Internet. Các quyết định này phải có người
có khả năng phân biệt tổn thương xác nhận trước khi dùng làm chuẩn đánh giá.

Đây là pilot nhãn điểm tập trung vào số đếm. Chưa có instance mask để train
segmentation: cần vẽ từng mask thật ở bước sau, không suy ra mask từ tâm/box.

## Điều kiện chạy train và mở rộng

1. Hoàn tất tách/gộp và xác nhận số đếm trên 50 ảnh; lưu nguồn người duyệt.
2. Duyệt nguồn ảnh/bệnh nhân/ảnh ghép trước khi khóa split; ảnh biến thể cùng nguồn
   phải cùng split. Tập test 5 ảnh chỉ dùng smoke test, không kết luận tổng quát.
3. Train model mới; không đánh giá độc lập bằng model cũ đã học cùng ảnh.
4. Báo MAE, lỗi đếm dư/thiếu, tỷ lệ đúng hoàn toàn, sai trong ±1/±2, kết quả theo
   mật độ nốt. Vùng ignore phải được xử lý riêng trong train/evaluation.
5. Chốt mức sai số chấp nhận được trước khi xem điểm test; nếu chưa chốt, chỉ báo
   số liệu và ví dụ lỗi, không gọi kết quả đạt. Không tự mở rộng chỉ vì train loss giảm.

Chưa train, chưa có MAE đếm, chưa mở rộng sang mọi ảnh. Kiểm tra hiện tại chỉ xác
nhận cấu trúc, checksum, tọa độ, số ảnh và cú pháp editor; không chứng minh nhãn đúng.

## Tái tạo (thư mục đích phải chưa tồn tại)

```powershell
python ml/build_counting_pilot.py D:\Download\Urticaria.v2i.yolov8.zip .data/ml/counting-pilot-50/selection.json .data/ml/counting-pilot-50/rebuild
```

Yêu cầu Pillow. Không thay đổi ZIP hoặc database.
