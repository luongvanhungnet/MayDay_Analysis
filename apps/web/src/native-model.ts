export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  identity: boolean;
  generated: boolean;
  pk: boolean;
  writable: boolean;
  options: string[];
}
export interface NativeTable {
  name: string;
  columns: Column[];
  relations: { columns: string[]; table: string; references: string[] }[];
  can_write: boolean;
  can_create: boolean;
  can_delete: boolean;
}
export type NativeRow = Record<string, string | number | boolean | null> & {
  _key: string;
};
export const titles: Record<string, string> = {
  nguoi: "Thông tin cá nhân",
  benhnhan: "Bệnh nhân",
  hosobenhan: "Hồ sơ bệnh án",
  benhanmaydaycap: "Bệnh án mề đay cấp",
  benhanmaydayman: "Bệnh án mề đay mạn",
  phienkham: "Phiên khám",
  phienkhamcap: "Khám mề đay cấp",
  phienkhamman: "Khám mề đay mạn",
  dauhieusinhton: "Dấu hiệu sinh tồn",
  tiensubanthan: "Tiền sử bản thân",
  benhsucacdotbenhtruoc: "Bệnh sử các đợt trước",
  hoancanhkhoiphatdiung: "Hoàn cảnh khởi phát dị ứng",
  tinhtrangnhiemtrung: "Tình trạng nhiễm trùng",
  chitiettonthuongcaptinh: "Tổn thương cấp tính",
  chitiettonthuongsanphu: "Tổn thương sẩn phù",
  ketquacanlamsang: "Kết quả cận lâm sàng",
  ketquacanlamsangcap: "Cận lâm sàng cấp",
  ketquacanlamsangman: "Cận lâm sàng mạn",
  ketquaproms: "Kết quả PROMs",
  phiennghiemphapkichthich: "Nghiệm pháp kích thích",
  chitietketquanghiemphap: "Kết quả nghiệm pháp",
  danhgiamucdohoatdongbenh: "Đánh giá hoạt động bệnh",
  donthuoc: "Đơn thuốc",
  chitietdonthuoc: "Chi tiết đơn thuốc",
  chidanngungthuoc: "Chỉ dẫn ngừng thuốc",
  dottonthuongda: "Đợt tổn thương da",
  vitritonthuong: "Vị trí tổn thương",
  anhchuptonthuong: "Ảnh chụp tổn thương",
  chukytheodoiuas7: "Chu kỳ theo dõi UAS7",
  nhatkyuashangngay: "Nhật ký UAS hằng ngày",
  nhatkyaashangngay: "Nhật ký AAS hằng ngày",
  sanglocbaodongdo: "Sàng lọc báo động đỏ",
  tepdinhkem: "Tệp đính kèm",
  chinhanh: "Chi nhánh",
  khoaphong: "Khoa phòng",
  phongkham: "Phòng khám",
  thuoc: "Danh mục thuốc",
  dacdiemsanphu: "Đặc điểm sẩn phù",
  loainghiemphap: "Loại nghiệm pháp",
  taikhoan: "Tài khoản",
  nhanvien: "Nhân viên",
  vaitro: "Vai trò",
  quyenhan: "Quyền hạn",
  vaitroquyenhan: "Quyền theo vai trò",
};
const labels: Record<string, string> = {
  ho_ten: "Họ và tên",
  ngay_sinh: "Ngày sinh",
  gioi_tinh: "Giới tính",
  so_dien_thoai: "Số điện thoại",
  ten_dang_nhap: "Tên đăng nhập",
  password: "Mật khẩu",
  loai_benh_an: "Loại bệnh án",
  trang_thai: "Trạng thái hồ sơ",
  ngay_kham: "Ngày khám",
  lan_kham_thu: "Lần khám thứ",
  dan_do: "Dặn dò",
  ma_his: "Mã HIS",
  nghe_nghiep: "Nghề nghiệp",
  dan_toc: "Dân tộc",
  bhyt_so_the: "Số thẻ BHYT",
  bhyt_gia_tri_den: "BHYT có giá trị đến",
  trang_thai_hoat_dong: "Đang hoạt động",
  diem_ngua_iss: "Điểm ngứa ISS",
  diem_san_phu_hss: "Điểm sẩn phù HSS",
  diem_uas_ngay: "Điểm UAS trong ngày",
  ngay_cham_diem: "Ngày chấm điểm",
  thoi_diem_tao: "Thời điểm tạo",
  thoi_diem_cap_nhat: "Cập nhật lần cuối",
  ma_benh_nhan: "Bệnh nhân",
  ma_nguoi: "Người",
  ma_ho_so: "Hồ sơ bệnh án",
  ma_phien_kham: "Phiên khám",
  ma_bac_si: "Bác sĩ",
  ma_chi_nhanh: "Chi nhánh",
  ma_khoa_phong: "Khoa phòng",
  ma_phong_kham: "Phòng khám",
  ma_vai_tro: "Vai trò",
  ma_tai_khoan: "Tài khoản",
  ma_thuoc: "Thuốc",
  ma_don_thuoc: "Đơn thuốc",
  ma_ho_so_man: "Hồ sơ mạn",
  ma_chu_ky: "Chu kỳ UAS7",
  ma_dot_ton_thuong_da: "Đợt tổn thương",
  ma_vi_tri_ton_thuong: "Vị trí tổn thương",
  ma_tep_dinh_kem: "Tệp đính kèm",
  lieu_dung: "Liều dùng",
  thoi_gian_dung: "Thời gian dùng",
  ten_thuoc_bo_sung: "Tên thuốc bổ sung",
  ghi_chu_dieu_tri: "Ghi chú điều trị",
  ten_thuoc: "Tên thuốc",
  hoat_chat: "Hoạt chất",
  nhom_dieu_tri: "Nhóm điều trị",
  ten_chi_nhanh: "Tên chi nhánh",
  ten_khoa_phong: "Tên khoa phòng",
  ten_phong_kham: "Tên phòng khám",
  dia_chi: "Địa chỉ",
  tom_tat_buoi_kham: "Tóm tắt buổi khám",
  huong_xu_tri_lan_sau: "Hướng xử trí lần sau",
  chan_doan_ban_dau_phong_kham: "Chẩn đoán ban đầu phòng khám",
  chan_doan_tuyen_truoc: "Chẩn đoán tuyến trước",
  thoi_gian_khoi_phat_tuan: "Thời gian khởi phát (tuần)",
  thoi_diem_kham_lan_dau: "Khám lần đầu",
  ten_vai_tro: "Tên vai trò",
  ten_hien_thi: "Tên hiển thị",
  ten_quyen_han: "Tên quyền hạn",
  nhom_quyen: "Nhóm quyền",
  mo_ta: "Mô tả",
  dia_chi_tinh_tp: "Tỉnh / thành phố",
  dia_chi_xa_phuong: "Xã / phường",
  dia_chi_so_nha_thon_pho: "Số nhà / thôn / phố",
  nguoi_nha_ho_ten_dia_chi: "Họ tên và địa chỉ người nhà",
  nguoi_nha_so_dien_thoai: "Số điện thoại người nhà",
  ngay_bat_dau: "Ngày bắt đầu",
  ngay_ket_thuc: "Ngày kết thúc",
  trang_thai_dung_thuoc: "Trạng thái dùng thuốc",
  trang_thai_ngay: "Trạng thái ngày",
  ngay_thu_may_trong_chu_ky: "Ngày thứ mấy trong chu kỳ",
};
export const label = (key: string) =>
  labels[key] || key.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
export const display = (value: unknown) =>
  value === null || value === undefined
    ? "—"
    : typeof value === "boolean"
      ? value
        ? "Có"
        : "Không"
      : String(value);
export const immutableOnEdit = new Set([
  "ma_benh_nhan",
  "ma_nguoi",
  "ma_ho_so",
  "ma_phien_kham",
  "loai_benh_an",
  "loai_ket_qua_can_lam_sang",
]);
export function formData(
  t: NativeTable,
  draft: Record<string, string>,
  original: NativeRow | null,
) {
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(draft)) {
    const c = t.columns.find((c) => c.name === name);
    if (original && String(original[name] ?? "") === value) continue;
    if (name === "password") {
      if (value) out.password = value;
      continue;
    }
    if (!c || !c.writable || (original && (c.pk || immutableOnEdit.has(name))))
      continue;
    if (value === "") {
      if (original) out[name] = null;
      continue;
    }
    out[name] = c.type === "boolean" ? value === "true" : value;
  }
  return out;
}
