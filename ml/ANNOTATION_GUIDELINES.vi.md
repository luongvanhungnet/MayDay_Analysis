# Quy tắc rà soát nhãn MayDay — bản đề xuất v1

Ngày: 2026-10-29. Trạng thái: đề xuất để người gán nhãn/chuyên gia da liễu xác nhận.
Không phải định nghĩa chính thức của tác giả dataset, không phải hướng dẫn chẩn đoán.
Chưa thay đổi nhãn gốc hoặc huấn luyện lại model.

## Mục tiêu và phạm vi

Baseline hiện phát hiện ba loại vùng Body/Multiple/Single. Không suy ra bệnh, số nốt
thật hoặc điểm AUAS từ tổng số khung. Cần thống nhất đơn vị gán nhãn trước khi sửa.
Giữ mapping gốc: 0=Body, 1=Multiple, 2=Single. Không đổi ID âm thầm.

| Lớp | Quy tắc đề xuất | Không dùng để |
|---|---|---|
| Body | Vùng da/cơ thể đang được quan sát. Khung bao sát phạm vi quan sát, theo cùng một quy ước giữa các ảnh. Người duyệt phải xác nhận lại vì nhiều nhãn gốc gần bằng toàn bộ ảnh. | Suy ra mask da, diện tích cơ thể hoặc loại bệnh |
| Single | Một tổn thương đơn, ranh giới quan sát được và tách biệt với vùng lân cận; danh tính tổn thương do người có chuyên môn xác nhận. | Đánh dấu mọi chấm đỏ/nốt ruồi/lỗ chân lông |
| Multiple | Một vùng tổn thương hợp lưu, không thể tách thành các đơn vị Single theo cùng quy tắc một cách đáng tin cậy. | Một khung lớn gom các Single tách biệt chỉ vì chúng gần nhau |

Nếu chuyên gia muốn đếm từng nốt, phải thiết kế bộ nhãn khác và gán lại vùng gộp;
không tự chuyển một Multiple thành một Single hoặc suy đoán số nốt bên trong.

## Quy tắc khung và vùng chồng nhau

- Khung chứa toàn bộ vùng đích nhìn thấy, sát biên nhất có thể, không thêm nền tùy ý.
- Body được chứa các vùng tổn thương; đây là chồng lớp có chủ đích.
- Cùng một vùng không được gán đồng thời Single và Multiple. Không gán khung trùng
  cùng lớp. Những vùng khác nhau sát nhau vẫn có thể có khung bao chồng nhau.
- Không sửa ranh giới chỉ để làm tăng IoU với model dự đoán.
- Polygon gốc được bảo toàn. Bản detection lấy khung bao polygon; không biến box
  thành mask giả. Nếu cần segmentation, phải gán mask phù hợp cho cả bộ dữ liệu.
- Khung dưới 5 pixel ở ảnh xuất 480×480 chỉ được gắn cờ để kiểm tra. Giữ nếu xác
  nhận được trên ảnh gốc rõ; nếu không rõ thì ghi unresolved và tìm ảnh gốc.
  Không tự xóa, phóng to khung hoặc đổi lớp để vượt ngưỡng.

## Chất lượng ảnh và nguồn dữ liệu

- Không tự coi tên file là bằng chứng loại bệnh. Chẳng hạn file chứa chữ
  allergic_contact_dermatitis phải được chuyên gia kiểm tra, không tự đổi nhãn.
- Với ảnh ghép (ví dụ ảnh #025 trong review pack), ưu tiên lấy ảnh nguồn riêng.
  Nếu tách panel, lưu ảnh dẫn xuất mới, chuyển tọa độ chính xác và gắn cùng source_group;
  không chia panel của cùng ảnh nguồn sang các split khác nhau.
- Không tự loại mọi ảnh mờ/nhiều nền: ghi mức chất lượng, vùng còn quan sát được,
  lý do giữ/loại. Ảnh không đủ căn cứ xác định nhãn cần được cách ly chờ duyệt.
- Nhãn thiếu chỉ bổ sung khi người duyệt xác nhận; không chép toàn bộ dự đoán của
  model thành nhãn thật.
- Ghi patient_group/source_group nếu biết. Không suy đoán danh tính từ ảnh.

## Quy trình duyệt toàn bộ 100 ảnh

1. Mở `.data/ml/annotation-review-v1/index.html`: trái là ảnh gốc, phải là overlay.
   L<number> trỏ đến dòng nhãn trong ZIP gốc, kể cả khi dòng trống được bỏ qua.
2. Ưu tiên 22 ảnh có cờ hình học, sau đó kiểm tra 78 ảnh còn lại. Không có cờ
   không có nghĩa là nhãn đúng. Quy tắc IoU trong script chỉ là bộ lọc ưu tiên.
3. Điền review.csv: reviewer, patient_group, decision, notes; status dùng pending,
   reviewed hoặc unresolved. Decision dùng keep, correct, quarantine, exclude.
4. Với correct, ghi rõ dòng L, lớp cũ/mới, tọa độ mới và lý do; với exclude/quarantine
   ghi lý do. Nên có người thứ hai duyệt trường hợp đổi Single/Multiple và nghi sai bệnh.
5. Chỉ xuất dataset v2 trong thư mục mới sau khi hoàn tất quyết định. Lưu changelog
   gồm nguồn, ảnh/dòng nhãn, trước/sau, người duyệt, lý do và checksum.
6. Kiểm tra lại tọa độ, nhãn trùng, nhóm nguồn và split. Mọi biến thể của cùng bệnh
   nhân/ảnh nguồn phải nằm cùng split. Khóa test trước khi chọn model tiếp theo.

Đã xem kết quả model trên test v1; nếu sửa test thì báo cáo bộ test v2 riêng và đánh
giá lại baseline trên v2 để so sánh công bằng. Không dùng kết quả test để quyết định
giữ/xóa nhãn. Không thể xác nhận nhãn đúng chỉ bằng confidence của model.

## Kết quả kiểm tra tự động ban đầu

- 100 ảnh; 1.877 nhãn: Body 114, Multiple 483, Single 1.280.
- 159 khung có ít nhất một cạnh dưới 5 pixel, nằm trên 22 ảnh.
- Không phát hiện nhãn ngoài biên, nhãn không hợp lệ, cặp cùng lớp IoU ≥0,9
  hoặc cặp Single/Multiple IoU ≥0,7 theo bộ kiểm tra hiện tại.
- 100/100 ảnh vẫn pending duyệt ngữ nghĩa. Chưa xác nhận nhãn thiếu/sai bệnh.
- ZIP gốc SHA256: `9b4dac46de9565bd165f2312553e96d77bcaffa628bf40c2eeb6b74c16a8363e`.

Tái tạo bộ rà soát (cần Pillow; output phải là thư mục chưa tồn tại):

```powershell
python ml/review_annotations.py D:\Download\Urticaria.v2i.yolov8.zip .data/ml/annotation-review-v2
```

Bộ rà soát chỉ tạo ảnh đối chiếu và báo cáo; không viết ngược vào ZIP hay nhãn train.
