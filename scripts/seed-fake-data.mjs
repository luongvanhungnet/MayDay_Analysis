import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();
const defaultPassword = process.env.SEED_DEMO_PASSWORD || 'MayDayDemo2026!';

async function seed() {
  console.log('🚀 Starting comprehensive fake data seeding for 100% database table coverage...\n');
  const hashedPassword = await hash(defaultPassword, 10);

  // =========================================================================
  // SECTION 1: Permissions & Role-Permissions (quyenhan, vaitroquyenhan)
  // =========================================================================
  console.log('🔹 Checking quyenhan & vaitroquyenhan...');
  const existingPerms = await prisma.$queryRawUnsafe(`SELECT count(*)::int as cnt FROM quyenhan`);
  if (existingPerms[0].cnt === 0) {
    const permissions = [
      { ten: 'xem_ho_so_benh_an', nhom: 'QUAN_LY_HO_SO', mo_ta: 'Xem danh sách và chi tiết hồ sơ bệnh án' },
      { ten: 'chinh_sua_ho_so_benh_an', nhom: 'QUAN_LY_HO_SO', mo_ta: 'Tạo mới và cập nhật hồ sơ bệnh án' },
      { ten: 'chot_ho_so_benh_an', nhom: 'QUAN_LY_HO_SO', mo_ta: 'Chốt và hoàn tất hồ sơ bệnh án' },
      { ten: 'tao_phien_kham', nhom: 'KHAM_BENH', mo_ta: 'Tạo phiên khám và ghi nhận chẩn đoán' },
      { ten: 'ghi_nhan_sinh_ton', nhom: 'KHAM_BENH', mo_ta: 'Ghi nhận dấu hiệu sinh tồn và tri giác' },
      { ten: 'ke_don_thuoc', nhom: 'KHAM_BENH', mo_ta: 'Kê đơn thuốc và chỉ dẫn ngừng thuốc' },
      { ten: 'thuc_hien_nghiem_phap', nhom: 'CAN_LAM_SANG', mo_ta: 'Thực hiện và ghi nhận kết quả nghiệm pháp kích thích' },
      { ten: 'nhap_ket_qua_can_lam_sang', nhom: 'CAN_LAM_SANG', mo_ta: 'Nhập và cập nhật kết quả xét nghiệm cận lâm sàng' },
      { ten: 'quan_tri_nguoi_dung', nhom: 'QUAN_TRI', mo_ta: 'Quản trị tài khoản, phân quyền và cơ sở' },
      { ten: 'ghi_nhat_ky_theo_doi', nhom: 'BENH_NHAN', mo_ta: 'Ghi nhật ký UAS7 và AAS hàng ngày' },
      { ten: 'tai_len_anh_ton_thuong', nhom: 'HINH_ANH', mo_ta: 'Tải lên hình ảnh tổn thương da và đánh giá' },
      { ten: 'sang_loc_bao_dong_do', nhom: 'BENH_NHAN', mo_ta: 'Thực hiện sàng lọc báo động đỏ phản vệ' }
    ];

    for (const p of permissions) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO quyenhan (ten_quyen_han, nhom_quyen, mo_ta)
        VALUES ('${p.ten}', '${p.nhom}', '${p.mo_ta}');
      `);
    }
    console.log(`  Added ${permissions.length} permissions to quyenhan.`);

    const perms = await prisma.$queryRawUnsafe(`SELECT ma_quyen_han, ten_quyen_han FROM quyenhan`);
    const permMap = Object.fromEntries(perms.map(p => [p.ten_quyen_han, p.ma_quyen_han]));

    // 1: admin, 2: bac_si, 3: dieu_duong, 4: benh_nhan
    const roleMappings = [
      // Admin: all
      ...perms.map(p => ({ role: 1, perm: p.ma_quyen_han })),
      // Bác sĩ: clinical & records & files
      ...['xem_ho_so_benh_an', 'chinh_sua_ho_so_benh_an', 'chot_ho_so_benh_an', 'tao_phien_kham', 'ghi_nhan_sinh_ton', 'ke_don_thuoc', 'thuc_hien_nghiem_phap', 'nhap_ket_qua_can_lam_sang', 'tai_len_anh_ton_thuong'].map(t => ({ role: 2, perm: permMap[t] })),
      // Điều dưỡng: vitals, tests, records
      ...['xem_ho_so_benh_an', 'tao_phien_kham', 'ghi_nhan_sinh_ton', 'thuc_hien_nghiem_phap', 'nhap_ket_qua_can_lam_sang', 'tai_len_anh_ton_thuong'].map(t => ({ role: 3, perm: permMap[t] })),
      // Bệnh nhân: diary, red flag, view own records, upload photo
      ...['xem_ho_so_benh_an', 'ghi_nhat_ky_theo_doi', 'tai_len_anh_ton_thuong', 'sang_loc_bao_dong_do'].map(t => ({ role: 4, perm: permMap[t] }))
    ];

    for (const rm of roleMappings) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO vaitroquyenhan (ma_vai_tro, ma_quyen_han, ma_nguoi_gan)
        VALUES (${rm.role}, ${rm.perm}, 1)
        ON CONFLICT DO NOTHING;
      `);
    }
    console.log(`  Mapped permissions in vaitroquyenhan.`);
  }

  // =========================================================================
  // SECTION 2: Reference Catalogs (dacdiemsanphu, thuoc)
  // =========================================================================
  console.log('🔹 Checking dacdiemsanphu & thuoc...');
  const existingDacDiem = await prisma.$queryRawUnsafe(`SELECT count(*)::int as cnt FROM dacdiemsanphu`);
  if (existingDacDiem[0].cnt === 0) {
    const dacdiemList = [
      { ten: 'Sẩn phù dạng bản đồ', mo_ta: 'Các mảng phù liên kết rộng với nhau, viền uốn lượn ngoằn ngoèo' },
      { ten: 'Sẩn phù dạng nốt tròn/oval', mo_ta: 'Các nốt sẩn phù kích thước 1-3cm riêng rẽ, ranh giới rõ ràng' },
      { ten: 'Sẩn phù kích thước nhỏ dạng hạt kê', mo_ta: 'Kích thước < 5mm, kèm quầng đỏ xung quanh, điển hình của mày đay cholinergic' },
      { ten: 'Sẩn phù viền đỏ tâm nhạt màu', mo_ta: 'Trung tâm nhạt màu do phù nề chèn ép mạch máu, viền hồng ban đậm' },
      { ten: 'Phù mạch mí mắt và môi', mo_ta: 'Sưng nề vùng mô lỏng lẻo mi mắt, môi trên/dưới, cảm giác căng rát hơn ngứa' }
    ];
    for (const d of dacdiemList) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO dacdiemsanphu (ten_dac_diem, mo_ta)
        VALUES ('${d.ten}', '${d.mo_ta}');
      `);
    }
    console.log(`  Added ${dacdiemList.length} items to dacdiemsanphu.`);
  }

  const existingThuoc = await prisma.$queryRawUnsafe(`SELECT count(*)::int as cnt FROM thuoc`);
  if (existingThuoc[0].cnt === 0) {
    const medList = [
      { ma: 'FEXO180', ten: 'Telfast HD 180mg', hoat_chat: 'Fexofenadine HCl', nhom: 'Khang histamine H1 TH2' },
      { ma: 'CETI10', ten: 'Zyrtec 10mg', hoat_chat: 'Cetirizine 2HCl', nhom: 'Khang histamine H1 TH2' },
      { ma: 'BILA20', ten: 'Bilaxten 20mg', hoat_chat: 'Bilastine', nhom: 'Khang histamine H1 TH2' },
      { ma: 'DESLO5', ten: 'Aerius 5mg', hoat_chat: 'Desloratadine', nhom: 'Khang histamine H1 TH2' },
      { ma: 'LEVO5', ten: 'Xyzal 5mg', hoat_chat: 'Levocetirizine 2HCl', nhom: 'Khang histamine H1 TH2' },
      { ma: 'RUPA10', ten: 'Rupafin 10mg', hoat_chat: 'Rupatadine fumarate', nhom: 'Khang histamine H1 TH2' },
      { ma: 'XOLAIR150', ten: 'Xolair 150mg', hoat_chat: 'Omalizumab', nhom: 'Sinh hoc/dich' },
      { ma: 'CYCLO50', ten: 'Neoral 50mg', hoat_chat: 'Cyclosporine A', nhom: 'Uc che mien dich' },
      { ma: 'MEDROL16', ten: 'Medrol 16mg', hoat_chat: 'Methylprednisolone', nhom: 'Corticosteroid toan than' },
      { ma: 'PRED5', ten: 'Prednisolon 5mg', hoat_chat: 'Prednisolone', nhom: 'Corticosteroid toan than' }
    ];
    for (const m of medList) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO thuoc (ma_thuoc, ten_thuoc, hoat_chat, nhom_dieu_tri)
        VALUES ('${m.ma}', '${m.ten}', '${m.hoat_chat}', '${m.nhom}')
        ON CONFLICT DO NOTHING;
      `);
    }
    console.log(`  Added ${medList.length} items to thuoc.`);
  }

  // =========================================================================
  // SECTION 3: Facilities (chinhanh, khoaphong, phongkham)
  // =========================================================================
  console.log('🔹 Ensuring rich chinhanh, khoaphong, phongkham...');
  const cnCount = await prisma.$queryRawUnsafe(`SELECT count(*)::int as cnt FROM chinhanh`);
  let cn2Id = 1;
  if (cnCount[0].cnt < 2) {
    const [cn2] = await prisma.$queryRawUnsafe(`
      INSERT INTO chinhanh (ten_chi_nhanh, dia_chi, so_dien_thoai, trang_thai)
      VALUES ('Phòng khám Đa khoa DrMayDay - Cơ sở Cầu Giấy', 'Số 88 Dịch Vọng Hậu, Cầu Giấy, Hà Nội', '02439999999', true)
      RETURNING ma_chi_nhanh;
    `);
    cn2Id = Number(cn2.ma_chi_nhanh);
    console.log(`  Created branch 2: ID ${cn2Id}`);
  }

  const kpCount = await prisma.$queryRawUnsafe(`SELECT count(*)::int as cnt FROM khoaphong`);
  let kp2Id = 1, kp3Id = 1;
  if (kpCount[0].cnt < 3) {
    const [kp2] = await prisma.$queryRawUnsafe(`
      INSERT INTO khoaphong (ten_khoa_phong, loai_khoa, mo_ta, ma_chi_nhanh)
      VALUES ('Khoa Dị ứng - Miễn dịch lâm sàng', 'KHOA_LAM_SANG', 'Khám và điều trị chuyên sâu mày đay, dị ứng', 1)
      RETURNING ma_khoa_phong;
    `);
    kp2Id = Number(kp2.ma_khoa_phong);

    const [kp3] = await prisma.$queryRawUnsafe(`
      INSERT INTO khoaphong (ten_khoa_phong, loai_khoa, mo_ta, ma_chi_nhanh)
      VALUES ('Khoa Khám bệnh Ngoại trú', 'KHOA_KHAM_BENH', 'Tiếp nhận và sàng lọc bệnh nhân ban đầu', ${cn2Id})
      RETURNING ma_khoa_phong;
    `);
    kp3Id = Number(kp3.ma_khoa_phong);
    console.log(`  Created departments: ${kp2Id}, ${kp3Id}`);
  } else {
    const kps = await prisma.$queryRawUnsafe(`SELECT ma_khoa_phong FROM khoaphong LIMIT 3`);
    kp2Id = Number(kps[kps.length - 1].ma_khoa_phong);
  }

  const pkCount = await prisma.$queryRawUnsafe(`SELECT count(*)::int as cnt FROM phongkham`);
  if (pkCount[0].cnt < 3) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO phongkham (ten_phong_kham, ma_khoa_phong)
      VALUES 
        ('Phòng khám Chuyên khoa Dị ứng 101', ${kp2Id}),
        ('Phòng Nghiệm pháp Kích thích & Test da', ${kp2Id})
      ON CONFLICT DO NOTHING;
    `);
    console.log(`  Added clinics to phongkham.`);
  }

  // =========================================================================
  // SECTION 4: Patients & Accounts (nguoi, benhnhan, taikhoan)
  // =========================================================================
  console.log('🔹 Checking patients & accounts...');
  const newPatients = [
    {
      ho_ten: 'Trần Thị Mai',
      ngay_sinh: '1995-04-12',
      gioi_tinh: 'Nu',
      so_dien_thoai: '0911223344',
      dia_chi_tinh_tp: 'Hà Nội',
      dia_chi_xa_phuong: 'Phường Dịch Vọng Hậu',
      dia_chi_so_nha_thon_pho: 'Số 15 ngõ 68 Cầu Giấy',
      ma_his: 'HIS_MAI_1995',
      nghe_nghiep: 'Can bo cong chuc',
      dan_toc: 'Kinh',
      bhyt_so_the: 'DN4010123456789',
      bhyt_gia_tri_den: '2028-12-31',
      nguoi_nha_ho_ten_dia_chi: 'Trần Văn An - Bố đẻ - Hà Nội',
      nguoi_nha_so_dien_thoai: '0988112233',
      ten_dang_nhap: '0911223344'
    },
    {
      ho_ten: 'Lê Hoàng Nam',
      ngay_sinh: '1988-09-23',
      gioi_tinh: 'Nam',
      so_dien_thoai: '0922334455',
      dia_chi_tinh_tp: 'Hải Phòng',
      dia_chi_xa_phuong: 'Phường Lạch Tray',
      dia_chi_so_nha_thon_pho: 'Số 42 Lạch Tray, Ngô Quyền',
      ma_his: 'HIS_NAM_1988',
      nghe_nghiep: 'Cong nhan',
      dan_toc: 'Kinh',
      bhyt_so_the: 'CN4010987654321',
      bhyt_gia_tri_den: '2027-06-30',
      nguoi_nha_ho_ten_dia_chi: 'Lê Thị Hoa - Vợ - Hải Phòng',
      nguoi_nha_so_dien_thoai: '0977223344',
      ten_dang_nhap: '0922334455'
    },
    {
      ho_ten: 'Phạm Minh Châu',
      ngay_sinh: '2002-11-05',
      gioi_tinh: 'Nu',
      so_dien_thoai: '0933445566',
      dia_chi_tinh_tp: 'Đà Nẵng',
      dia_chi_xa_phuong: 'Phường Hải Châu 1',
      dia_chi_so_nha_thon_pho: 'Số 102 Trần Phú',
      ma_his: 'HIS_CHAU_2002',
      nghe_nghiep: 'Hoc sinh - Sinh vien',
      dan_toc: 'Kinh',
      bhyt_so_the: 'SV4010555666777',
      bhyt_gia_tri_den: '2026-12-31',
      nguoi_nha_ho_ten_dia_chi: 'Phạm Quang Hùng - Bố - Đà Nẵng',
      nguoi_nha_so_dien_thoai: '0966334455',
      ten_dang_nhap: '0933445566'
    }
  ];

  const createdPatientIds = [];
  for (const p of newPatients) {
    const existing = await prisma.$queryRawUnsafe(`SELECT ma_nguoi FROM nguoi WHERE so_dien_thoai = '${p.so_dien_thoai}'`);
    if (existing.length === 0) {
      const [person] = await prisma.$queryRawUnsafe(`
        INSERT INTO nguoi (ho_ten, ngay_sinh, gioi_tinh, so_dien_thoai, dia_chi_tinh_tp, dia_chi_xa_phuong, dia_chi_so_nha_thon_pho)
        VALUES ('${p.ho_ten}', '${p.ngay_sinh}', '${p.gioi_tinh}', '${p.so_dien_thoai}', '${p.dia_chi_tinh_tp}', '${p.dia_chi_xa_phuong}', '${p.dia_chi_so_nha_thon_pho}')
        RETURNING ma_nguoi;
      `);
      const personId = Number(person.ma_nguoi);

      await prisma.$executeRawUnsafe(`
        INSERT INTO benhnhan (ma_benh_nhan, ma_his, nghe_nghiep, dan_toc, bhyt_so_the, bhyt_gia_tri_den, nguoi_nha_ho_ten_dia_chi, nguoi_nha_so_dien_thoai)
        VALUES (${personId}, '${p.ma_his}', '${p.nghe_nghiep}', '${p.dan_toc}', '${p.bhyt_so_the}', '${p.bhyt_gia_tri_den}', '${p.nguoi_nha_ho_ten_dia_chi}', '${p.nguoi_nha_so_dien_thoai}');
      `);

      await prisma.$executeRawUnsafe(`
        INSERT INTO taikhoan (ma_nguoi, ma_vai_tro, ten_dang_nhap, mat_khau_ma_hoa, trang_thai_hoat_dong)
        VALUES (${personId}, 4, '${p.ten_dang_nhap}', '${hashedPassword}', true)
        ON CONFLICT DO NOTHING;
      `);
      createdPatientIds.push(personId);
      console.log(`  Created patient: ${p.ho_ten} (ID: ${personId})`);
    } else {
      createdPatientIds.push(Number(existing[0].ma_nguoi));
    }
  }

  // Update existing patient 2's profile for completeness
  await prisma.$executeRawUnsafe(`
    UPDATE benhnhan 
    SET ma_his = 'HIS_BENHNHAN_02',
        nghe_nghiep = 'Hoc sinh - Sinh vien',
        dan_toc = 'Kinh',
        bhyt_so_the = 'GD4010123456789',
        bhyt_gia_tri_den = '2027-12-31',
        nguoi_nha_ho_ten_dia_chi = 'Nguyễn Văn B - Bố - Hà Nội',
        nguoi_nha_so_dien_thoai = '0988771122'
    WHERE ma_benh_nhan = 2;
  `);

  // Ensure all demo & test accounts have the unified password (MayDayDemo2026!) and are active
  console.log('🔹 Synchronizing demo credentials for all roles...');
  const demoAccounts = [
    'admin_test',
    'bacsi_test',
    'dieuduong_test',
    'benhnhan_test',
    '0900000001',
    '0988776656',
    '0912345678',
    '0911223344',
    '0922334455',
    '0933445566',
    '0900000000'
  ];
  for (const username of demoAccounts) {
    await prisma.$executeRawUnsafe(`
      UPDATE taikhoan 
      SET mat_khau_ma_hoa = '${hashedPassword}', trang_thai_hoat_dong = true 
      WHERE lower(ten_dang_nhap) = lower('${username}');
    `);
  }
  console.log(`  Synchronized ${demoAccounts.length} test accounts to password "${defaultPassword}".`);

  // =========================================================================
  // SECTION 5: Medical Records (hosobenhan + benhanmaydaycap/man)
  // =========================================================================
  console.log('🔹 Checking hosobenhan and subtypes...');
  // Ensure we have at least 2 CAP and 2 MAN records
  const ptMai = createdPatientIds[0] || 2;
  const ptNam = createdPatientIds[1] || 21;
  const ptChau = createdPatientIds[2] || 22;

  // Let's check existing hosobenhan records
  const existingHos = await prisma.$queryRawUnsafe(`SELECT ma_ho_so, loai_benh_an, ma_benh_nhan FROM hosobenhan ORDER BY ma_ho_so`);
  console.log('  Existing records:', existingHos);

  let hsCap1 = existingHos.find(h => h.loai_benh_an === 'CAP');
  let hsMan1 = existingHos.find(h => h.loai_benh_an === 'MAN');

  // If no MAN record exists, create one
  if (!hsMan1) {
    await prisma.$transaction(async (tx) => {
      const [res] = await tx.$queryRawUnsafe(`
        INSERT INTO hosobenhan (ma_benh_nhan, loai_benh_an, chan_doan_ban_dau_phong_kham, trang_thai, thoi_gian_khoi_phat_tuan, tien_su_gia_dinh, ket_qua_dieu_tri_bao_hiem, thoi_diem_kham_lan_dau, ngay_bat_dau_dieu_tri_ngoai_tru, ngay_ket_thuc_dieu_tri_ngoai_tru)
        VALUES (2, 'MAN', 'Mày đay mạn tính tự phát (CSU)', 'in_progress', 8.00, 'Khong', 'Do', '2026-10-15 08:30:00+07', '2026-10-15', '2026-11-15')
        RETURNING ma_ho_so;
      `);
      const hid = Number(res.ma_ho_so);
      await tx.$executeRawUnsafe(`
        INSERT INTO benhanmaydayman (ma_ho_so, chan_doan_chinh, phan_nhom_csu, chung_da_ve_noi, may_day_cholinergic, may_day_do_lanh, bieu_hien_qua_trinh_benh)
        VALUES (${hid}, 'CSU', 'CSU Type I', true, false, false, 'San phu + phu mach');
      `);
      hsMan1 = { ma_ho_so: BigInt(hid), loai_benh_an: 'MAN', ma_benh_nhan: 2n };
      console.log(`  Created first MAN record: ID ${hid}`);
    });
  }

  // Create Record MAN 2 for ptMai
  let hsMan2Id = null;
  const hsMan2Check = await prisma.$queryRawUnsafe(`SELECT ma_ho_so FROM hosobenhan WHERE ma_benh_nhan = ${ptMai} AND loai_benh_an = 'MAN'`);
  if (hsMan2Check.length === 0) {
    await prisma.$transaction(async (tx) => {
      const [res] = await tx.$queryRawUnsafe(`
        INSERT INTO hosobenhan (ma_benh_nhan, loai_benh_an, chan_doan_ban_dau_phong_kham, trang_thai, thoi_gian_khoi_phat_tuan, tien_su_gia_dinh, tien_su_gia_dinh_ghi_ro, ket_qua_dieu_tri_bao_hiem, thoi_diem_kham_lan_dau, ngay_bat_dau_dieu_tri_ngoai_tru, ngay_ket_thuc_dieu_tri_ngoai_tru)
        VALUES (${ptMai}, 'MAN', 'Mày đay mạn tính tự phát kết hợp mày đay do lạnh', 'in_progress', 16.00, 'Co', 'Mẹ đẻ bị viêm da cơ địa và mày đay', 'Do', '2026-10-20 09:00:00+07', '2026-10-20', '2026-11-20')
        RETURNING ma_ho_so;
      `);
      hsMan2Id = Number(res.ma_ho_so);
      await tx.$executeRawUnsafe(`
        INSERT INTO benhanmaydayman (ma_ho_so, chan_doan_chinh, phan_nhom_csu, chung_da_ve_noi, may_day_cholinergic, may_day_do_lanh, bieu_hien_qua_trinh_benh)
        VALUES (${hsMan2Id}, 'CSU + CIndU', 'CSU Type IIb', true, false, true, 'San phu + phu mach');
      `);
      console.log(`  Created second MAN record: ID ${hsMan2Id}`);
    });
  } else {
    hsMan2Id = Number(hsMan2Check[0].ma_ho_so);
  }

  // Create Record CAP 2 for ptNam
  let hsCap2Id = null;
  const hsCap2Check = await prisma.$queryRawUnsafe(`SELECT ma_ho_so FROM hosobenhan WHERE ma_benh_nhan = ${ptNam} AND loai_benh_an = 'CAP'`);
  if (hsCap2Check.length === 0) {
    await prisma.$transaction(async (tx) => {
      const [res] = await tx.$queryRawUnsafe(`
        INSERT INTO hosobenhan (ma_benh_nhan, loai_benh_an, chan_doan_ban_dau_phong_kham, trang_thai, thoi_gian_khoi_phat_tuan, tien_su_gia_dinh, ket_qua_dieu_tri_bao_hiem, thoi_diem_kham_lan_dau, ngay_bat_dau_dieu_tri_ngoai_tru, ngay_ket_thuc_dieu_tri_ngoai_tru)
        VALUES (${ptNam}, 'CAP', 'Mày đay cấp sau dùng kháng sinh Amoxicillin', 'completed', 1.00, 'Khong', 'Khoi benh', '2026-11-01 10:00:00+07', '2026-11-01', '2026-11-08')
        RETURNING ma_ho_so;
      `);
      hsCap2Id = Number(res.ma_ho_so);
      await tx.$executeRawUnsafe(`
        INSERT INTO benhanmaydaycap (ma_ho_so, cd_may_day_cap_thong_thuong, cd_may_day_cap_nang, nhom_yeu_to_nghi_ngo, co_nghi_ngo_dot_nay, ten_yeu_to_nghi_ngo, thoi_gian_tiep_xuc_den_khoi_phat, thoi_gian_keo_dai_tb, dot_gan_nhat_cach, tuoi_lan_dau_bi_benh, so_lan_may_day_cap_truoc)
        VALUES (${hsCap2Id}, false, true, 'Thuoc', true, 'Amoxicillin 500mg', '30 minutes'::interval, '12 hours'::interval, '1 year'::interval, 30, 0);
      `);
      console.log(`  Created second CAP record: ID ${hsCap2Id}`);
    });
  } else {
    hsCap2Id = Number(hsCap2Check[0].ma_ho_so);
  }

  // Update hsCap1 with richer clinical data
  const cap1Id = Number(hsCap1.ma_ho_so);
  await prisma.$executeRawUnsafe(`
    UPDATE benhanmaydaycap
    SET cd_may_day_cap_thong_thuong = true,
        nhom_yeu_to_nghi_ngo = 'Thuc an',
        co_nghi_ngo_dot_nay = true,
        ten_yeu_to_nghi_ngo = 'Tom bien nuong',
        thoi_gian_tiep_xuc_den_khoi_phat = '1 hour'::interval,
        thoi_gian_keo_dai_tb = '6 hours'::interval,
        dot_gan_nhat_cach = '30 days'::interval,
        tuoi_lan_dau_bi_benh = 20,
        so_lan_may_day_cap_truoc = 2
    WHERE ma_ho_so = ${cap1Id};
  `);

  const man1Id = Number(hsMan1.ma_ho_so);

  // =========================================================================
  // SECTION 6: Record Details (tiensubanthan, hoancanhkhoiphatdiung, tinhtrangnhiemtrung, benhsucacdotbenhtruoc)
  // =========================================================================
  console.log('🔹 Checking record-linked details tables...');

  // 1. tiensubanthan
  for (const hid of [cap1Id, man1Id, hsMan2Id, hsCap2Id]) {
    const ex = await prisma.$queryRawUnsafe(`SELECT 1 FROM tiensubanthan WHERE ma_ho_so = ${hid}`);
    if (ex.length === 0) {
      if (hid === cap1Id) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO tiensubanthan (ma_ho_so, tien_su_co_dia, tien_su_co_dia_ghi_ro, tien_su_di_ung, tien_su_di_ung_ghi_ro, tien_su_phan_ve, tien_su_tuyen_giap, tien_su_tu_mien, tien_su_viem_nhiem_man, tien_su_benh_khac)
          VALUES (${hid}, true, 'Viêm mũi dị ứng thời tiết', true, 'Dị ứng cua ghẹ biển', false, false, false, false, false);
        `);
      } else if (hid === man1Id) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO tiensubanthan (ma_ho_so, tien_su_co_dia, tien_su_co_dia_ghi_ro, tien_su_tuyen_giap, tien_su_tuyen_giap_ghi_ro, tien_su_tu_mien, tien_su_di_ung, tien_su_phan_ve, tien_su_viem_nhiem_man, tien_su_benh_khac)
          VALUES (${hid}, true, 'Hen phế quản nhẹ có kiểm soát', true, 'Viêm tuyến giáp mạn Hashimoto ổn định', false, false, false, false, false);
        `);
      } else if (hid === hsMan2Id) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO tiensubanthan (ma_ho_so, tien_su_co_dia, tien_su_tuyen_giap, tien_su_tu_mien, tien_su_tu_mien_ghi_ro, tien_su_di_ung, tien_su_phan_ve, tien_su_viem_nhiem_man, tien_su_viem_nhiem_man_ghi_ro, tien_su_benh_khac)
          VALUES (${hid}, false, false, true, 'Kháng thể kháng nhân ANA (+) hiệu giá 1/160', false, false, true, 'Viêm xoang mạn tính hay tái phát', false);
        `);
      } else {
        await prisma.$executeRawUnsafe(`
          INSERT INTO tiensubanthan (ma_ho_so, tien_su_di_ung, tien_su_di_ung_ghi_ro, tien_su_co_dia, tien_su_tuyen_giap, tien_su_tu_mien, tien_su_phan_ve, tien_su_viem_nhiem_man, tien_su_benh_khac)
          VALUES (${hid}, true, 'Dị ứng kháng sinh nhóm Beta-lactam', false, false, false, false, false, false);
        `);
      }
    }
  }
  console.log('  tiensubanthan seeded.');

  // 2. hoancanhkhoiphatdiung
  for (const hid of [cap1Id, man1Id, hsMan2Id, hsCap2Id]) {
    const ex = await prisma.$queryRawUnsafe(`SELECT 1 FROM hoancanhkhoiphatdiung WHERE ma_ho_so = ${hid}`);
    if (ex.length === 0) {
      if (hid === cap1Id) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO hoancanhkhoiphatdiung (ma_ho_so, thuc_an_nghi_ngo, thuc_an_thoi_gian, thuc_an_tung_bi, thuc_an_tien_su_ghi_ro, thuc_an_loai_tien_su, thuoc_tung_bi, con_trung_tung_bi, khac_tung_bi)
          VALUES (${hid}, 'Tôm nướng và mực hấp', 2, true, 'Nổi mề đay sau ăn tôm 2 năm trước', 'Di ung hai san', false, false, false);
        `);
      } else if (hid === man1Id) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO hoancanhkhoiphatdiung (ma_ho_so, khac_nghi_ngo, khac_thoi_gian, khac_tung_bi, khac_tien_su_ghi_ro, khac_loai_tien_su, thuc_an_tung_bi, thuoc_tung_bi, con_trung_tung_bi)
          VALUES (${hid}, 'Gió lạnh mùa đông và tắm nước lạnh', 1, true, 'Mùa đông hàng năm hay bị nổi sẩn phù ngứa', 'May day do lanh', false, false, false);
        `);
      } else if (hid === hsMan2Id) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO hoancanhkhoiphatdiung (ma_ho_so, khac_nghi_ngo, khac_thoi_gian, khac_tung_bi, khac_tien_su_ghi_ro, khac_loai_tien_su, thuc_an_tung_bi, thuoc_tung_bi, con_trung_tung_bi)
          VALUES (${hid}, 'Căng thẳng stress công việc và vận động thể lực', 3, true, 'Nổi mẩn đỏ nhỏ khi ra mồ hôi nhiều', 'Cholinergic', false, false, false);
        `);
      } else {
        await prisma.$executeRawUnsafe(`
          INSERT INTO hoancanhkhoiphatdiung (ma_ho_so, thuoc_nghi_ngo, thuoc_thoi_gian, thuoc_tung_bi, thuoc_tien_su_ghi_ro, thuoc_loai_tien_su, thuc_an_tung_bi, con_trung_tung_bi, khac_tung_bi)
          VALUES (${hid}, 'Amoxicillin 500mg viên nén', 1, true, 'Nổi ban sau uống Augmentin năm 2024', 'Di ung thuoc', false, false, false);
        `);
      }
    }
  }
  console.log('  hoancanhkhoiphatdiung seeded.');

  // 3. tinhtrangnhiemtrung (Only for CAP records)
  for (const hid of [cap1Id, hsCap2Id]) {
    const ex = await prisma.$queryRawUnsafe(`SELECT 1 FROM tinhtrangnhiemtrung WHERE ma_ho_so = ${hid}`);
    if (ex.length === 0) {
      if (hid === cap1Id) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO tinhtrangnhiemtrung (ma_ho_so, ho_hap_ho, ho_hap_dau_hong, ho_hap_so_mui, ho_hap_hat_hoi, ho_hap_thoi_gian, ho_hap_khoang_cach, tiet_nieu_tieu_rat, tiet_nieu_tieu_buot, tiet_nieu_thoi_gian, tiet_nieu_khoang_cach, da_mun, da_nhot, da_thoi_gian, da_khoang_cach)
          VALUES (${hid}, true, true, false, false, 3, 1, false, false, 0, 0, false, false, 0, 0);
        `);
      } else {
        await prisma.$executeRawUnsafe(`
          INSERT INTO tinhtrangnhiemtrung (ma_ho_so, ho_hap_ho, ho_hap_dau_hong, ho_hap_so_mui, ho_hap_hat_hoi, ho_hap_thoi_gian, ho_hap_khoang_cach, tiet_nieu_tieu_rat, tiet_nieu_tieu_buot, tiet_nieu_thoi_gian, tiet_nieu_khoang_cach, da_mun, da_nhot, da_thoi_gian, da_khoang_cach)
          VALUES (${hid}, false, false, false, false, 0, 0, true, true, 5, 2, false, false, 0, 0);
        `);
      }
    }
  }
  console.log('  tinhtrangnhiemtrung seeded.');

  // 4. benhsucacdotbenhtruoc (Only for MAN records)
  for (const hid of [man1Id, hsMan2Id]) {
    const ex = await prisma.$queryRawUnsafe(`SELECT 1 FROM benhsucacdotbenhtruoc WHERE ma_ho_so = ${hid}`);
    if (ex.length === 0) {
      if (hid === man1Id) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO benhsucacdotbenhtruoc (ma_ho_so, tung_co_dot_tuong_tu, tuoi_khoi_phat, so_dot_truoc, kieu_dien_bien, bieu_hien_dot_truoc, da_tung_nhap_vien, so_lan_nhap_vien, thoi_gian_tu_dot_gan_nhat, dien_bien_cac_dot_truoc)
          VALUES (${hid}, true, 22, 5, 'Tai phat theo dot', 'Sẩn phù ngứa từng mảng ở thân mình và đùi', false, 0, 14, 'Đáp ứng một phần với kháng histamine H1, tái phát sau dừng thuốc');
        `);
      } else {
        await prisma.$executeRawUnsafe(`
          INSERT INTO benhsucacdotbenhtruoc (ma_ho_so, tung_co_dot_tuong_tu, tuoi_khoi_phat, so_dot_truoc, kieu_dien_bien, bieu_hien_dot_truoc, da_tung_nhap_vien, so_lan_nhap_vien, thoi_gian_tu_dot_gan_nhat, dien_bien_cac_dot_truoc)
          VALUES (${hid}, true, 19, 8, 'Keo dai lien tuc > 6 tuan', 'Sẩn phù toàn thân kết hợp sưng nề mi mắt và môi', true, 1, 7, 'Đợt gần nhất phải vào viện cấp cứu do phù môi và mí mắt nhiều');
        `);
      }
    }
  }
  console.log('  benhsucacdotbenhtruoc seeded.');

  // =========================================================================
  // SECTION 7: Clinical Sessions (phienkham + phienkhamcap/man)
  // =========================================================================
  console.log('🔹 Checking phienkham and clinical sessions...');
  const existingPk = await prisma.$queryRawUnsafe(`SELECT ma_phien_kham, loai_benh_an, ma_ho_so FROM phienkham`);
  let pkCap1Id = null, pkMan1Id = null, pkMan2Id = null, pkCap2Id = null;

  if (existingPk.length === 0) {
    // Session 1: CAP for cap1Id
    await prisma.$transaction(async (tx) => {
      const [res] = await tx.$queryRawUnsafe(`
        INSERT INTO phienkham (ma_ho_so, ma_bac_si, ma_phong_kham, loai_benh_an, ngay_kham, lan_kham_thu, loai_phien_kham, ngay_hen_tai_kham, tom_tat_buoi_kham, huong_xu_tri_lan_sau, dan_do)
        VALUES (${cap1Id}, 6, 1, 'CAP', '2026-11-02', 1, 'Kham cap cuu', '2026-11-09', 'Mày đay cấp tính sau ăn tôm biển, sẩn phù nhiều ở thân mình', 'Cắt cơn bằng kháng histamine, tái khám nếu còn ban', 'Tránh ăn hải sản và các thức ăn lạ')
        RETURNING ma_phien_kham;
      `);
      pkCap1Id = Number(res.ma_phien_kham);
      await tx.$executeRawUnsafe(`
        INSERT INTO phienkhamcap (ma_phien_kham, co_san_phu, co_anh_san_phu, trieu_chung_da, trieu_chung_tieu_hoa, so_lan_non)
        VALUES (${pkCap1Id}, true, true, 'Sẩn phù nổi rải rác toàn thân, nhiều ở thân mình và cẳng tay', 'Buồn nôn nhẹ sau ăn hải sản', 0);
      `);
      console.log(`  Created phienkham CAP 1: ID ${pkCap1Id}`);
    });

    // Session 2: MAN for man1Id
    await prisma.$transaction(async (tx) => {
      const [res] = await tx.$queryRawUnsafe(`
        INSERT INTO phienkham (ma_ho_so, ma_bac_si, ma_phong_kham, loai_benh_an, ngay_kham, lan_kham_thu, loai_phien_kham, ngay_hen_tai_kham, tom_tat_buoi_kham, huong_xu_tri_lan_sau, dan_do)
        VALUES (${man1Id}, 13, 1, 'MAN', '2026-11-03', 1, 'Kham lan dau', '2026-12-03', 'Mày đay mạn tính tự phát 8 tuần, có kèm phù mạch nhẹ', 'Tăng liều kháng H1 lên gấp đôi, ghi nhật ký UAS7', 'Theo dõi điểm UAS7 mỗi ngày vào buổi tối')
        RETURNING ma_phien_kham;
      `);
      pkMan1Id = Number(res.ma_phien_kham);
      await tx.$executeRawUnsafe(`
        INSERT INTO phienkhamman (ma_phien_kham, hien_tai_co_san_phu, uu_the_ngau_nhien, vi_tri_san_phu, trong_dot_co_phu_mach, hien_tai_co_phu_mach, so_lan_phu_mach_dot_nay, so_lan_phu_mach_nang_phai_nhap_vien, diem_aas7, phu_mi_mat, phu_moi, phu_thanh_quan)
        VALUES (${pkMan1Id}, true, true, 'Ngực, lưng, mặt trước đùi và hai cánh tay', true, false, 2, 0, 6, true, true, false);
      `);
      console.log(`  Created phienkham MAN 1: ID ${pkMan1Id}`);
    });

    // Session 3: MAN for hsMan2Id
    await prisma.$transaction(async (tx) => {
      const [res] = await tx.$queryRawUnsafe(`
        INSERT INTO phienkham (ma_ho_so, ma_bac_si, ma_phong_kham, loai_benh_an, ngay_kham, lan_kham_thu, loai_phien_kham, ngay_hen_tai_kham, tom_tat_buoi_kham, huong_xu_tri_lan_sau, dan_do)
        VALUES (${hsMan2Id}, 19, 1, 'MAN', '2026-11-04', 1, 'Kham chuyen khoa', '2026-12-04', 'Mày đay mạn tính kháng trị, kết hợp phù mạch và test lạnh dương tính', 'Cân nhắc chỉ định Omalizumab (Xolair)', 'Mang theo áo ấm, tránh để cơ thể nhiễm lạnh đột ngột')
        RETURNING ma_phien_kham;
      `);
      pkMan2Id = Number(res.ma_phien_kham);
      await tx.$executeRawUnsafe(`
        INSERT INTO phienkhamman (ma_phien_kham, hien_tai_co_san_phu, uu_the_ngau_nhien, uu_the_kich_thich, thoi_gian_kich_thich_tuan, vi_tri_san_phu, trong_dot_co_phu_mach, hien_tai_co_phu_mach, so_lan_phu_mach_dot_nay, so_lan_phu_mach_nang_phai_nhap_vien, diem_aas7, phu_mi_mat, phu_moi, phu_ban_tay, phu_thanh_quan)
        VALUES (${pkMan2Id}, true, false, true, 12, 'Toàn thân, tập trung ở vùng da hở và nếp gấp', true, true, 3, 1, 14, true, true, true, false);
      `);
      console.log(`  Created phienkham MAN 2: ID ${pkMan2Id}`);
    });

    // Session 4: CAP for hsCap2Id
    await prisma.$transaction(async (tx) => {
      const [res] = await tx.$queryRawUnsafe(`
        INSERT INTO phienkham (ma_ho_so, ma_bac_si, ma_phong_kham, loai_benh_an, ngay_kham, lan_kham_thu, loai_phien_kham, ngay_hen_tai_kham, tom_tat_buoi_kham, huong_xu_tri_lan_sau, dan_do)
        VALUES (${hsCap2Id}, 6, 1, 'CAP', '2026-11-05', 1, 'Kham cap', '2026-11-12', 'Mày đay cấp nặng sau dùng Amoxicillin, tổn thương dạng mảng lớn', 'Ngừng ngay Amoxicillin, dùng kháng H1 và Prednisolone', 'Ghi chú dị ứng kháng sinh vào sổ khám bệnh')
        RETURNING ma_phien_kham;
      `);
      pkCap2Id = Number(res.ma_phien_kham);
      await tx.$executeRawUnsafe(`
        INSERT INTO phienkhamcap (ma_phien_kham, co_san_phu, co_anh_san_phu, trieu_chung_da, so_lan_non)
        VALUES (${pkCap2Id}, true, true, 'Hồng ban phù nề dạng mảng lớn ở thân mình và hai đùi', 1);
      `);
      console.log(`  Created phienkham CAP 2: ID ${pkCap2Id}`);
    });
  } else {
    pkCap1Id = Number(existingPk.find(p => p.loai_benh_an === 'CAP')?.ma_phien_kham || existingPk[0].ma_phien_kham);
    pkMan1Id = Number(existingPk.find(p => p.loai_benh_an === 'MAN')?.ma_phien_kham || existingPk[0].ma_phien_kham);
    pkMan2Id = pkMan1Id;
    pkCap2Id = pkCap1Id;
  }

  // =========================================================================
  // SECTION 8: Clinical Details (dauhieusinhton, chitiettonthuongcaptinh, chitiettonthuongsanphu, danhgiamucdohoatdongbenh, ketquaproms, phiennghiemphapkichthich, chitietketquanghiemphap)
  // =========================================================================
  console.log('🔹 Checking session details & examination tables...');

  // 1. dauhieusinhton
  const vitalsCount = await prisma.$queryRawUnsafe(`SELECT count(*)::int as cnt FROM dauhieusinhton`);
  if (vitalsCount[0].cnt === 0) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO dauhieusinhton (ma_phien_kham, ma_bac_si, tri_giac, nhiet_do, spo2, mach, huyet_ap_tam_thu, huyet_ap_tam_truong, nhip_tho, bat_thuong_co_quan_khac)
      VALUES 
        (${pkCap1Id}, 6, 'Tỉnh táo, tiếp xúc tốt', 37.0, 99, 82, 120, 80, 18, false),
        (${pkMan1Id}, 13, 'Tỉnh táo', 36.6, 98, 76, 115, 75, 16, false),
        (${pkMan2Id}, 19, 'Tỉnh táo, mệt mỏi do ngứa', 36.8, 98, 88, 125, 85, 19, false),
        (${pkCap2Id}, 6, 'Tỉnh táo, lo lắng', 37.2, 97, 92, 110, 70, 20, false);
    `);
    console.log('  dauhieusinhton seeded.');
  }

  // 2. chitiettonthuongcaptinh (Only for phienkhamcap)
  const capLesCount = await prisma.$queryRawUnsafe(`SELECT count(*)::int as cnt FROM chitiettonthuongcaptinh`);
  if (capLesCount[0].cnt === 0) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO chitiettonthuongcaptinh (ma_phien_kham, dang_ton_thuong, kich_thuoc_max_mm, kich_thuoc_min_mm, kich_thuoc_dong_deu_mm, thoi_gian_ton_tai_tb, so_luong_san_phu, vi_tri)
      VALUES 
        (${pkCap1Id}, 'Hồng ban sẩn phù', 35.0, 8.0, 15.0, 4.5, 25, 'Thân mình, cẳng tay hai bên, cổ'),
        (${pkCap2Id}, 'Sẩn phù mảng lớn dạng bản đồ', 80.0, 15.0, 40.0, 8.0, 15, 'Ngực, bụng, lưng, hai bên đùi');
    `);
    console.log('  chitiettonthuongcaptinh seeded.');
  }

  // 3. chitiettonthuongsanphu (Only for phienkhamman)
  const manLesCount = await prisma.$queryRawUnsafe(`SELECT count(*)::int as cnt FROM chitiettonthuongsanphu`);
  if (manLesCount[0].cnt === 0) {
    const dacdiem = await prisma.$queryRawUnsafe(`SELECT ma_dac_diem_san_phu FROM dacdiemsanphu LIMIT 2`);
    const dd1 = Number(dacdiem[0].ma_dac_diem_san_phu);
    const dd2 = Number(dacdiem[1].ma_dac_diem_san_phu);

    await prisma.$executeRawUnsafe(`
      INSERT INTO chitiettonthuongsanphu (ma_phien_kham, dang_ton_thuong, kich_thuoc, thoi_gian_ton_tai, ma_dac_diem_san_phu, so_luong, vi_tri)
      VALUES 
        (${pkMan1Id}, 'Sẩn phù hình tròn/oval', 20.0, 6.0, ${dd1}, 30, 'Cẳng tay, ngực, lưng, mặt trước đùi'),
        (${pkMan2Id}, 'Sẩn phù dạng bản đồ kết hợp nốt nhỏ', 50.0, 12.0, ${dd2}, 45, 'Toàn thân, tập trung ở các nếp gấp và vùng da hở');
    `);
    console.log('  chitiettonthuongsanphu seeded.');
  }

  // 4. danhgiamucdohoatdongbenh (Only for phienkhamman)
  const actCount = await prisma.$queryRawUnsafe(`SELECT count(*)::int as cnt FROM danhgiamucdohoatdongbenh`);
  if (actCount[0].cnt === 0) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO danhgiamucdohoatdongbenh (ma_phien_kham_man, du_du_lieu_7_ngay, ma_nguoi_danh_gia, hss7_san_phu_khong_dung_thuoc, iss7_ngua_khong_dung_thuoc, uas7_tong_khong_dung_thuoc, hss7_san_phu_dung_thuoc_deu, iss7_ngua_dung_thuoc_deu, uas7_tong_dung_thuoc_deu, ghi_chu)
      VALUES 
        (${pkMan1Id}, true, 13, 14, 16, 30, 6, 7, 13, 'Mày đay hoạt động mức độ nặng khi không dùng thuốc, đáp ứng một phần với kháng H1'),
        (${pkMan2Id}, true, 19, 18, 19, 37, 12, 14, 26, 'Mày đay khó kiểm soát, hoạt động mức độ nặng dai dẳng, cân nhắc nâng bậc sinh học');
    `);
    console.log('  danhgiamucdohoatdongbenh seeded.');
  }

  // 5. ketquaproms (Only for phienkhamman)
  const promsCount = await prisma.$queryRawUnsafe(`SELECT count(*)::int as cnt FROM ketquaproms`);
  if (promsCount[0].cnt === 0) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO ketquaproms (ma_phien_kham_man, uct_diem, aect_diem, act_diem_legacy, dlqi_diem, cu_q2ol_diem)
      VALUES 
        (${pkMan1Id}, 9, 11, 8, 12, 42.50),
        (${pkMan2Id}, 4, 6, 5, 21, 68.00);
    `);
    console.log('  ketquaproms seeded.');
  }

  // 6. phiennghiemphapkichthich & chitietketquanghiemphap
  const npCount = await prisma.$queryRawUnsafe(`SELECT count(*)::int as cnt FROM phiennghiemphapkichthich`);
  if (npCount[0].cnt === 0) {
    const [pnp1] = await prisma.$queryRawUnsafe(`
      INSERT INTO phiennghiemphapkichthich (ma_phien_kham, ngung_khang_histamine, thoi_gian_ngung_histamine, ngung_corticoid, thoi_gian_ngung_corticoid)
      VALUES (${pkMan1Id}, true, 5.0, true, 14.0)
      RETURNING ma_phien_nghiem_phap;
    `);
    const pnp1Id = Number(pnp1.ma_phien_nghiem_phap);

    const [pnp2] = await prisma.$queryRawUnsafe(`
      INSERT INTO phiennghiemphapkichthich (ma_phien_kham, ngung_khang_histamine, thoi_gian_ngung_histamine, ngung_corticoid, thoi_gian_ngung_corticoid)
      VALUES (${pkMan2Id}, true, 7.0, false, null)
      RETURNING ma_phien_nghiem_phap;
    `);
    const pnp2Id = Number(pnp2.ma_phien_nghiem_phap);

    await prisma.$executeRawUnsafe(`
      INSERT INTO chitietketquanghiemphap (ma_phien_nghiem_phap, loai_nghiem_phap, la_can_nguyen_khac, ket_qua, nguong_gia_tri_so, don_vi_do, diem_ngua_nrs, diem_bong_rat_nrs, diem_dau_nrs)
      VALUES 
        (${pnp1Id}, 1, false, 'Duong tinh', 4.0, 'diem', 6, 3, 1),
        (${pnp1Id}, 4, false, 'Am tinh', 4.0, 'phut', 0, 0, 0),
        (${pnp2Id}, 5, false, 'Duong tinh', 5.0, 'phut', 8, 5, 2);
    `);

    // Add row with la_can_nguyen_khac = true
    await prisma.$executeRawUnsafe(`
      INSERT INTO chitietketquanghiemphap (ma_phien_nghiem_phap, loai_nghiem_phap, la_can_nguyen_khac, can_nguyen_khac_ten, ket_qua, nguong_gia_tri_so, don_vi_do, diem_ngua_nrs, diem_bong_rat_nrs, diem_dau_nrs)
      VALUES (${pnp2Id}, 9, true, 'Test rung động cơ học bằng máy Vortex', 'Duong tinh', 3.0, 'phut', 5, 2, 1);
    `);
    console.log('  phiennghiemphapkichthich & chitietketquanghiemphap seeded.');
  }

  // =========================================================================
  // SECTION 9: Laboratory Results (ketquacanlamsang + ketquacanlamsangcap/man)
  // =========================================================================
  console.log('🔹 Checking laboratory test results...');
  const existingCls = await prisma.$queryRawUnsafe(`SELECT count(*)::int as cnt FROM ketquacanlamsang`);
  if (existingCls[0].cnt === 0) {
    // 1. CAP for pkCap1Id
    await prisma.$transaction(async (tx) => {
      const [res] = await tx.$queryRawUnsafe(`
        INSERT INTO ketquacanlamsang (ma_phien_kham, loai_ket_qua_can_lam_sang, wbc, crp, ige_toan_phan, can_lam_sang_khac_ghi_chu, thoi_diem_thuc_hien)
        VALUES (${pkCap1Id}, 'CAP', 8.6, 4.2, 185.0, 'Bạch cầu tăng nhẹ phù hợp đợt cấp', '2026-11-02 10:30:00+07')
        RETURNING ma_ket_qua_can_lam_sang;
      `);
      const cid = Number(res.ma_ket_qua_can_lam_sang);
      await tx.$executeRawUnsafe(`
        INSERT INTO ketquacanlamsangcap (ma_ket_qua_can_lam_sang, lym, neu, plt, tryptase_cap, tryptase_nen)
        VALUES (${cid}, 2.1, 5.8, 260.0, 8.5, 4.2);
      `);
      console.log(`  Created lab test CAP 1: ID ${cid}`);
    });

    // 2. MAN for pkMan1Id
    await prisma.$transaction(async (tx) => {
      const [res] = await tx.$queryRawUnsafe(`
        INSERT INTO ketquacanlamsang (ma_phien_kham, loai_ket_qua_can_lam_sang, wbc, crp, ige_toan_phan, can_lam_sang_khac_ghi_chu, thoi_diem_thuc_hien)
        VALUES (${pkMan1Id}, 'MAN', 6.8, 1.8, 450.0, 'IgE toàn phần tăng cao, ASST dương tính', '2026-11-03 11:00:00+07')
        RETURNING ma_ket_qua_can_lam_sang;
      `);
      const mid = Number(res.ma_ket_qua_can_lam_sang);
      await tx.$executeRawUnsafe(`
        INSERT INTO ketquacanlamsangman (ma_ket_qua_can_lam_sang, test_huyet_thanh_tu_than, asst_duong_kinh_mm, ige_khang_tpo_ket_qua, bat_ket_qua, ige_khang_il24_ket_qua, eo, ba_bach_cau, anti_tpo, tsh, ft4, ft3, mau_lang_1h, mau_lang_2h, ana_hep2, sieu_am_tuyen_giap)
        VALUES (${mid}, 'Duong tinh', 14.5, 'Duong tinh', 'Duong tinh', 'Am tinh', 0.28, 0.04, 78.5, 2.45, 15.2, 4.6, 12.0, 25.0, 'Duong tinh', 'Nhu mô tuyến giáp giảm âm rải rác phù hợp viêm tuyến giáp tự miễn');
      `);
      console.log(`  Created lab test MAN 1: ID ${mid}`);
    });

    // 3. MAN for pkMan2Id
    await prisma.$transaction(async (tx) => {
      const [res] = await tx.$queryRawUnsafe(`
        INSERT INTO ketquacanlamsang (ma_phien_kham, loai_ket_qua_can_lam_sang, wbc, crp, ige_toan_phan, can_lam_sang_khac_ghi_chu, thoi_diem_thuc_hien)
        VALUES (${pkMan2Id}, 'MAN', 7.2, 2.5, 620.0, 'Kháng thể kháng IL-24 (+), ASST (+)', '2026-11-04 11:30:00+07')
        RETURNING ma_ket_qua_can_lam_sang;
      `);
      const mid2 = Number(res.ma_ket_qua_can_lam_sang);
      await tx.$executeRawUnsafe(`
        INSERT INTO ketquacanlamsangman (ma_ket_qua_can_lam_sang, test_huyet_thanh_tu_than, asst_duong_kinh_mm, ige_khang_tpo_ket_qua, bat_ket_qua, ige_khang_il24_ket_qua, eo, ba_bach_cau, anti_tpo, tsh, ft4, ft3, mau_lang_1h, mau_lang_2h, ana_hep2)
        VALUES (${mid2}, 'Duong tinh', 18.0, 'Am tinh', 'Duong tinh', 'Duong tinh', 0.35, 0.06, 15.0, 1.85, 16.0, 4.8, 18.0, 36.0, 'Am tinh');
      `);
      console.log(`  Created lab test MAN 2: ID ${mid2}`);
    });

    // 4. CAP for pkCap2Id
    await prisma.$transaction(async (tx) => {
      const [res] = await tx.$queryRawUnsafe(`
        INSERT INTO ketquacanlamsang (ma_phien_kham, loai_ket_qua_can_lam_sang, wbc, crp, ige_toan_phan, can_lam_sang_khac_ghi_chu, thoi_diem_thuc_hien)
        VALUES (${pkCap2Id}, 'CAP', 11.5, 12.0, 310.0, 'Bạch cầu và CRP tăng cao trong phản ứng cấp tính', '2026-11-05 14:00:00+07')
        RETURNING ma_ket_qua_can_lam_sang;
      `);
      const cid2 = Number(res.ma_ket_qua_can_lam_sang);
      await tx.$executeRawUnsafe(`
        INSERT INTO ketquacanlamsangcap (ma_ket_qua_can_lam_sang, lym, neu, plt, tryptase_cap, tryptase_nen)
        VALUES (${cid2}, 1.8, 8.5, 310.0, 11.2, 3.8);
      `);
      console.log(`  Created lab test CAP 2: ID ${cid2}`);
    });
  }

  // =========================================================================
  // SECTION 10: Prescriptions (donthuoc, chitietdonthuoc, chidanngungthuoc)
  // =========================================================================
  console.log('🔹 Checking prescriptions...');
  const donCount = await prisma.$queryRawUnsafe(`SELECT count(*)::int as cnt FROM donthuoc`);
  if (donCount[0].cnt === 0) {
    // Prescription 1: for Session 2, Record MAN 1
    const [dt1] = await prisma.$queryRawUnsafe(`
      INSERT INTO donthuoc (ma_ho_so, ma_phien_kham, ngay_ke_don, trang_thai_don, ghi_chu_dieu_tri, ngung_thuoc_lan_sau, thuoc_can_ngung_truoc_tai_kham)
      VALUES (${man1Id}, ${pkMan1Id}, '2026-11-03', 'DANG_DIEU_TRI', 'Kháng histamine H1 liều tăng gấp đôi, theo dõi sát UAS7', true, 'Ngừng Bilastine 5 ngày trước tái khám để làm test kích thích')
      RETURNING ma_don_thuoc;
    `);
    const dt1Id = Number(dt1.ma_don_thuoc);

    await prisma.$executeRawUnsafe(`
      INSERT INTO chitietdonthuoc (ma_don_thuoc, ma_thuoc, lieu_dung, thoi_gian_dung, ma_ke_hoach_dieu_tri)
      VALUES 
        (${dt1Id}, 'BILA20', '20mg x 2 viên/ngày (sáng 1 viên, tối 1 viên trước ăn 1h)', '30 ngày', 'STEP2_HIGH_DOSE_AH'),
        (${dt1Id}, 'FEXO180', '180mg x 1 viên/ngày (uống trưa khi ngứa tăng)', '14 ngày', 'STEP2_ADDON_AH');
    `);

    // Supplement non-catalog drug
    await prisma.$executeRawUnsafe(`
      INSERT INTO chitietdonthuoc (ma_don_thuoc, ten_thuoc_bo_sung, lieu_dung, thoi_gian_dung, ma_ke_hoach_dieu_tri)
      VALUES (${dt1Id}, 'Kem dưỡng ẩm mềm da Physiogel Hypoallergenic', 'Bôi vùng da tổn thương 2-3 lần/ngày', '30 ngày', 'SUPPORTIVE_CARE');
    `);

    await prisma.$executeRawUnsafe(`
      INSERT INTO chidanngungthuoc (ma_don_thuoc, thuoc_can_ngung, ngung_tu_ngay, thoi_gian_ngung_ngay, muc_dich)
      VALUES 
        (${dt1Id}, 'Bilaxten 20mg (Bilastine)', '2026-11-28', 5, 'Test kich thich'),
        (${dt1Id}, 'Kháng histamine thế hệ 1 (nếu có dùng thêm)', '2026-11-30', 3, 'Test huyet thanh tu than');
    `);

    // Prescription 2: for Session 1, Record CAP 1
    const [dt2] = await prisma.$queryRawUnsafe(`
      INSERT INTO donthuoc (ma_ho_so, ma_phien_kham, ngay_ke_don, trang_thai_don, ghi_chu_dieu_tri, ngung_thuoc_lan_sau)
      VALUES (${cap1Id}, ${pkCap1Id}, '2026-11-02', 'HOAN_THANH', 'Cắt cơn mày đay cấp bằng kháng H1 phối hợp corticoid ngắn ngày', false)
      RETURNING ma_don_thuoc;
    `);
    const dt2Id = Number(dt2.ma_don_thuoc);

    await prisma.$executeRawUnsafe(`
      INSERT INTO chitietdonthuoc (ma_don_thuoc, ma_thuoc, lieu_dung, thoi_gian_dung, ma_ke_hoach_dieu_tri)
      VALUES 
        (${dt2Id}, 'CETI10', '10mg x 1 viên/ngày uống tối sau ăn', '7 ngày', 'ACUTE_PROTOCOL'),
        (${dt2Id}, 'MEDROL16', '16mg x 1 viên/ngày uống sáng sau ăn no', '3 ngày', 'SHORT_COURSE_STEROID');
    `);

    // Prescription 3: for Session 3, Record MAN 2
    const [dt3] = await prisma.$queryRawUnsafe(`
      INSERT INTO donthuoc (ma_ho_so, ma_phien_kham, ngay_ke_don, trang_thai_don, ghi_chu_dieu_tri, ngung_thuoc_lan_sau, thuoc_can_ngung_truoc_tai_kham)
      VALUES (${hsMan2Id}, ${pkMan2Id}, '2026-11-04', 'DANG_DIEU_TRI', 'Kháng H1 liều cao kết hợp chuẩn bị phác đồ Omalizumab', true, 'Ngừng các thuốc dị ứng ngoài đơn trước tái khám')
      RETURNING ma_don_thuoc;
    `);
    const dt3Id = Number(dt3.ma_don_thuoc);

    await prisma.$executeRawUnsafe(`
      INSERT INTO chitietdonthuoc (ma_don_thuoc, ma_thuoc, lieu_dung, thoi_gian_dung, ma_ke_hoach_dieu_tri)
      VALUES 
        (${dt3Id}, 'XOLAIR150', '300mg (2 lọ 150mg) tiêm dưới da mỗi 4 tuần', '24 tuần', 'STEP3_BIOLOGIC'),
        (${dt3Id}, 'DESLO5', '5mg x 2 viên/ngày uống sáng và tối', '28 ngày', 'STEP3_MAINTENANCE');
    `);

    await prisma.$executeRawUnsafe(`
      INSERT INTO chidanngungthuoc (ma_don_thuoc, thuoc_can_ngung, ngung_tu_ngay, thoi_gian_ngung_ngay, muc_dich, muc_dich_khac_ghi_ro)
      VALUES (${dt3Id}, 'Thuốc bôi ngoài da có chứa Corticoid', '2026-11-20', 7, 'Khac', 'Tránh ảnh hưởng đến kết quả đánh giá nốt ban da');
    `);

    console.log('  donthuoc, chitietdonthuoc & chidanngungthuoc seeded.');
  }

  // =========================================================================
  // SECTION 11: Patient Diaries (chukytheodoiuas7, nhatkyuashangngay, nhatkyaashangngay)
  // =========================================================================
  console.log('🔹 Checking UAS7 & AAS tracking diaries...');
  const ckCount = await prisma.$queryRawUnsafe(`SELECT count(*)::int as cnt FROM chukytheodoiuas7`);
  if (ckCount[0].cnt === 0) {
    // Cycle 1 for patient 2, record man1Id
    const [ck1] = await prisma.$queryRawUnsafe(`
      INSERT INTO chukytheodoiuas7 (ma_benh_nhan, ngay_bat_dau, ngay_ket_thuc, trang_thai_chu_ky)
      VALUES (2, '2026-11-01', '2026-11-07', 'HOAN_THANH')
      RETURNING ma_chu_ky;
    `);
    const ck1Id = Number(ck1.ma_chu_ky);

    // 7 days of UAS logs
    const daysData = [
      { day: '2026-11-01', num: 1, hss: 2, iss: 2, drug: 'DUNG_THUOC_DEU' },
      { day: '2026-11-02', num: 2, hss: 3, iss: 3, drug: 'KHONG_DUNG_THUOC' },
      { day: '2026-11-03', num: 3, hss: 2, iss: 2, drug: 'DUNG_THUOC_DEU' },
      { day: '2026-11-04', num: 4, hss: 1, iss: 2, drug: 'DUNG_THUOC_DEU' },
      { day: '2026-11-05', num: 5, hss: 1, iss: 1, drug: 'DUNG_THUOC_DEU' },
      { day: '2026-11-06', num: 6, hss: 2, iss: 2, drug: 'DUNG_THUOC_KHONG_DEU' },
      { day: '2026-11-07', num: 7, hss: 1, iss: 1, drug: 'DUNG_THUOC_DEU' }
    ];

    for (const d of daysData) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO nhatkyuashangngay (ma_chu_ky, ma_ho_so_man, ma_benh_nhan, ngay_cham_diem, ngay_thu_may_trong_chu_ky, diem_san_phu_hss, diem_ngua_iss, trang_thai_dung_thuoc, trang_thai_ngay)
        VALUES (${ck1Id}, ${man1Id}, 2, '${d.day}', ${d.num}, ${d.hss}, ${d.iss}, '${d.drug}', 'HOP_LE')
        ON CONFLICT DO NOTHING;
      `);
    }

    // AAS logs for patient 2
    await prisma.$executeRawUnsafe(`
      INSERT INTO nhatkyaashangngay (ma_benh_nhan, ma_ho_so_man, ngay_theo_doi, co_dot_sung_phu, thoi_diem_xuat_hien, muc_kho_chiu, han_che_hoat_dong, anh_huong_ngoai_hinh, do_nang_tong_the)
      VALUES 
        (2, ${man1Id}, '2026-11-02', true, 'Sáng sớm sau khi ngủ dậy', 2, 1, 2, 2),
        (2, ${man1Id}, '2026-11-03', false, null, null, null, null, null),
        (2, ${man1Id}, '2026-11-05', true, 'Buổi tối trước khi đi ngủ', 1, 1, 1, 1)
      ON CONFLICT DO NOTHING;
    `);

    // Cycle 2 for ptMai, record hsMan2Id
    const [ck2] = await prisma.$queryRawUnsafe(`
      INSERT INTO chukytheodoiuas7 (ma_benh_nhan, ngay_bat_dau, ngay_ket_thuc, trang_thai_chu_ky)
      VALUES (${ptMai}, '2026-11-02', '2026-11-08', 'DANG_THEO_DOI')
      RETURNING ma_chu_ky;
    `);
    const ck2Id = Number(ck2.ma_chu_ky);

    const daysData2 = [
      { day: '2026-11-02', num: 1, hss: 3, iss: 3, drug: 'DUNG_THUOC_DEU' },
      { day: '2026-11-03', num: 2, hss: 3, iss: 2, drug: 'DUNG_THUOC_DEU' },
      { day: '2026-11-04', num: 3, hss: 2, iss: 3, drug: 'DUNG_THUOC_DEU' },
      { day: '2026-11-05', num: 4, hss: 2, iss: 2, drug: 'DUNG_THUOC_DEU' },
      { day: '2026-11-06', num: 5, hss: 1, iss: 2, drug: 'DUNG_THUOC_DEU' },
      { day: '2026-11-07', num: 6, hss: 2, iss: 1, drug: 'DUNG_THUOC_DEU' }
    ];

    for (const d of daysData2) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO nhatkyuashangngay (ma_chu_ky, ma_ho_so_man, ma_benh_nhan, ngay_cham_diem, ngay_thu_may_trong_chu_ky, diem_san_phu_hss, diem_ngua_iss, trang_thai_dung_thuoc, trang_thai_ngay)
        VALUES (${ck2Id}, ${hsMan2Id}, ${ptMai}, '${d.day}', ${d.num}, ${d.hss}, ${d.iss}, '${d.drug}', 'HOP_LE')
        ON CONFLICT DO NOTHING;
      `);
    }

    await prisma.$executeRawUnsafe(`
      INSERT INTO nhatkyaashangngay (ma_benh_nhan, ma_ho_so_man, ngay_theo_doi, co_dot_sung_phu, thoi_diem_xuat_hien, muc_kho_chiu, han_che_hoat_dong, anh_huong_ngoai_hinh, do_nang_tong_the)
      VALUES 
        (${ptMai}, ${hsMan2Id}, '2026-11-04', true, 'Nửa đêm', 3, 2, 3, 3),
        (${ptMai}, ${hsMan2Id}, '2026-11-06', false, null, null, null, null, null)
      ON CONFLICT DO NOTHING;
    `);

    console.log('  chukytheodoiuas7, nhatkyuashangngay & nhatkyaashangngay seeded.');
  }

  // =========================================================================
  // SECTION 12: Red Flag Screening (sanglocbaodongdo)
  // =========================================================================
  console.log('🔹 Checking sanglocbaodongdo...');
  const slCount = await prisma.$queryRawUnsafe(`SELECT count(*)::int as cnt FROM sanglocbaodongdo`);
  if (slCount[0].cnt === 0) {
    // 1. Normal screening
    await prisma.$executeRawUnsafe(`
      INSERT INTO sanglocbaodongdo (ma_benh_nhan, co_kho_tho_kho_khe_nghen_hong, co_chong_mat_tuc_nguc_sap_ngat, co_sung_moi_luoi_co_hong, co_dau_bung_non_lien_tuc, xac_nhan_muon_goi_cap_cuu, da_nhan_nut_goi_cap_cuu)
      VALUES (2, false, false, false, false, null, false);
    `);

    // 2. Anaphylaxis emergency
    await prisma.$executeRawUnsafe(`
      INSERT INTO sanglocbaodongdo (ma_benh_nhan, co_kho_tho_kho_khe_nghen_hong, co_chong_mat_tuc_nguc_sap_ngat, co_sung_moi_luoi_co_hong, co_dau_bung_non_lien_tuc, xac_nhan_muon_goi_cap_cuu, da_nhan_nut_goi_cap_cuu, so_dien_thoai_cap_cuu, thoi_diem_nhan_nut_goi)
      VALUES (21, true, true, true, false, true, true, '115', '2026-11-02 08:35:00+07');
    `);

    // 3. Normal screening for ptNam
    await prisma.$executeRawUnsafe(`
      INSERT INTO sanglocbaodongdo (ma_benh_nhan, co_kho_tho_kho_khe_nghen_hong, co_chong_mat_tuc_nguc_sap_ngat, co_sung_moi_luoi_co_hong, co_dau_bung_non_lien_tuc, xac_nhan_muon_goi_cap_cuu, da_nhan_nut_goi_cap_cuu)
      VALUES (${ptNam}, false, false, false, false, null, false);
    `);

    console.log('  sanglocbaodongdo seeded.');
  }

  // =========================================================================
  // SECTION 13: Attachments & Lesions (tepdinhkem, dottonthuongda, vitritonthuong, anhchuptonthuong)
  // =========================================================================
  console.log('🔹 Checking attachments, lesion episodes & photos...');
  const tepCount = await prisma.$queryRawUnsafe(`SELECT count(*)::int as cnt FROM tepdinhkem`);
  if (tepCount[0].cnt === 0) {
    // 1. tepdinhkem
    const [t1] = await prisma.$queryRawUnsafe(`
      INSERT INTO tepdinhkem (ma_ho_so, ma_tai_khoan, ten_tep_goc, duong_dan_luu_tru, duong_dan_url, dinh_dang_tep, loai_phuong_tien, dung_luong_byte, phan_loai_muc_dich, mo_ta_tep, diem_do_mo)
      VALUES (${man1Id}, 2, 'anh_san_phu_cang_tay.jpg', '.data/uploads/lesion_pt2_01.jpg', '/api/v1/media/lesion_pt2_01.jpg', 'image/jpeg', 'HINH_ANH', 1458200, 'ANH_TON_THUONG', 'Ảnh chụp sẩn phù cẳng tay lúc mới khởi phát', 12.50)
      RETURNING ma_tep_dinh_kem;
    `);
    const t1Id = Number(t1.ma_tep_dinh_kem);

    const [t2] = await prisma.$queryRawUnsafe(`
      INSERT INTO tepdinhkem (ma_ho_so, ma_tai_khoan, ten_tep_goc, duong_dan_luu_tru, duong_dan_url, dinh_dang_tep, loai_phuong_tien, dung_luong_byte, phan_loai_muc_dich, mo_ta_tep, diem_do_mo)
      VALUES (${man1Id}, 2, 'anh_san_phu_lung.jpg', '.data/uploads/lesion_pt2_02.jpg', '/api/v1/media/lesion_pt2_02.jpg', 'image/jpeg', 'HINH_ANH', 2048500, 'ANH_TON_THUONG', 'Ảnh chụp sẩn phù dạng bản đồ vùng lưng', 8.00)
      RETURNING ma_tep_dinh_kem;
    `);
    const t2Id = Number(t2.ma_tep_dinh_kem);

    const [t3] = await prisma.$queryRawUnsafe(`
      INSERT INTO tepdinhkem (ma_ho_so, ma_tai_khoan, ten_tep_goc, duong_dan_luu_tru, duong_dan_url, dinh_dang_tep, loai_phuong_tien, dung_luong_byte, phan_loai_muc_dich, mo_ta_tep, diem_do_mo)
      VALUES (${hsMan2Id}, 1, 'phu_mach_moi_mat.jpg', '.data/uploads/lesion_pt4_01.jpg', '/api/v1/media/lesion_pt4_01.jpg', 'image/jpeg', 'HINH_ANH', 1820400, 'ANH_TON_THUONG', 'Ảnh chụp phù mạch môi trên và mi mắt', 15.00)
      RETURNING ma_tep_dinh_kem;
    `);
    const t3Id = Number(t3.ma_tep_dinh_kem);

    const [t4] = await prisma.$queryRawUnsafe(`
      INSERT INTO tepdinhkem (ma_ho_so, ma_tai_khoan, ten_tep_goc, duong_dan_luu_tru, duong_dan_url, dinh_dang_tep, loai_phuong_tien, dung_luong_byte, phan_loai_muc_dich, mo_ta_tep, diem_do_mo)
      VALUES (${cap1Id}, 18, 'hong_ban_cap_tinh.jpg', '.data/uploads/lesion_pt21_01.jpg', '/api/v1/media/lesion_pt21_01.jpg', 'image/jpeg', 'HINH_ANH', 1240100, 'ANH_TON_THUONG', 'Hồng ban sẩn phù nổi cấp sau ăn hải sản', 10.20)
      RETURNING ma_tep_dinh_kem;
    `);
    const t4Id = Number(t4.ma_tep_dinh_kem);

    // 2. dottonthuongda
    const [dot1] = await prisma.$queryRawUnsafe(`
      INSERT INTO dottonthuongda (ma_benh_nhan, ma_ho_so_man, ten_dot_ton_thuong_da, thoi_diem_xuat_hien, hoan_canh_xuat_hien, chi_tiet_dot_ton_thuong)
      VALUES (2, ${man1Id}, 'Đợt sẩn phù bùng phát tháng 11/2026', '2026-11-01 19:30:00+07', 'Tiep xuc lanh', 'Nổi nốt sẩn đỏ ngứa nhiều sau khi đi gió lạnh về')
      RETURNING ma_dot_ton_thuong_da;
    `);
    const dot1Id = Number(dot1.ma_dot_ton_thuong_da);

    const [dot2] = await prisma.$queryRawUnsafe(`
      INSERT INTO dottonthuongda (ma_benh_nhan, ma_ho_so_man, ten_dot_ton_thuong_da, thoi_diem_xuat_hien, hoan_canh_xuat_hien, hoan_canh_xuat_hien_khac, chi_tiet_dot_ton_thuong)
      VALUES (2, ${man1Id}, 'Đợt ngứa sẩn phù sau ăn cay nóng', '2026-11-04 12:15:00+07', 'Khac', 'Sau khi ăn lẩu cay nóng và uống nước ngọt có ga', 'Cảm giác nóng rát da toàn thân rồi xuất hiện nốt sẩn')
      RETURNING ma_dot_ton_thuong_da;
    `);
    const dot2Id = Number(dot2.ma_dot_ton_thuong_da);

    const [dot3] = await prisma.$queryRawUnsafe(`
      INSERT INTO dottonthuongda (ma_benh_nhan, ma_ho_so_man, ten_dot_ton_thuong_da, thoi_diem_xuat_hien, hoan_canh_xuat_hien, chi_tiet_dot_ton_thuong)
      VALUES (${ptMai}, ${hsMan2Id}, 'Đợt phù mạch và mày đay nặng', '2026-11-03 22:00:00+07', 'Van dong manh / Do mo hoi', 'Sau tập gym ra nhiều mồ hôi, da nổi sẩn ngứa li ti rồi lan thành mảng')
      RETURNING ma_dot_ton_thuong_da;
    `);
    const dot3Id = Number(dot3.ma_dot_ton_thuong_da);

    // 3. vitritonthuong
    const [vt1] = await prisma.$queryRawUnsafe(`
      INSERT INTO vitritonthuong (ma_dot_ton_thuong_da, vi_tri_co_the, thoi_diem_xuat_hien, hoan_canh_xuat_hien)
      VALUES (${dot1Id}, 'Cẳng tay trái và cẳng tay phải', '2026-11-01 19:45:00+07', 'Tiep xuc lanh')
      RETURNING ma_vi_tri_ton_thuong;
    `);
    const vt1Id = Number(vt1.ma_vi_tri_ton_thuong);

    const [vt2] = await prisma.$queryRawUnsafe(`
      INSERT INTO vitritonthuong (ma_dot_ton_thuong_da, vi_tri_co_the, thoi_diem_xuat_hien, hoan_canh_xuat_hien)
      VALUES (${dot1Id}, 'Vùng lưng và thắt lưng', '2026-11-01 20:30:00+07', 'Tiep xuc lanh')
      RETURNING ma_vi_tri_ton_thuong;
    `);
    const vt2Id = Number(vt2.ma_vi_tri_ton_thuong);

    const [vt3] = await prisma.$queryRawUnsafe(`
      INSERT INTO vitritonthuong (ma_dot_ton_thuong_da, vi_tri_co_the, thoi_diem_xuat_hien, hoan_canh_xuat_hien, hoan_canh_xuat_hien_khac)
      VALUES (${dot2Id}, 'Vùng ngực và bụng', '2026-11-04 12:30:00+07', 'Khac', 'Sau khi ăn lẩu cay')
      RETURNING ma_vi_tri_ton_thuong;
    `);
    const vt3Id = Number(vt3.ma_vi_tri_ton_thuong);

    const [vt4] = await prisma.$queryRawUnsafe(`
      INSERT INTO vitritonthuong (ma_dot_ton_thuong_da, vi_tri_co_the, thoi_diem_xuat_hien, hoan_canh_xuat_hien)
      VALUES (${dot3Id}, 'Mí mắt và môi trên', '2026-11-03 22:30:00+07', 'Tu phat')
      RETURNING ma_vi_tri_ton_thuong;
    `);
    const vt4Id = Number(vt4.ma_vi_tri_ton_thuong);

    // 4. anhchuptonthuong
    await prisma.$executeRawUnsafe(`
      INSERT INTO anhchuptonthuong (ma_tep_dinh_kem, ma_dot_ton_thuong_da, ma_vi_tri_ton_thuong, thoi_diem_chup, moc_tien_trien, diem_ngua_nrs, diem_dau_nrs, diem_bong_rat_nrs, so_luong_not_san, chi_so_auas_cuc_bo, url_anh)
      VALUES 
        (${t1Id}, ${dot1Id}, ${vt1Id}, '2026-11-01 20:00:00+07', 'KHOI_PHAT', 8, 2, 4, 18, 3.50, '/api/v1/media/lesion_pt2_01.jpg'),
        (${t2Id}, ${dot1Id}, ${vt2Id}, '2026-11-01 21:00:00+07', 'TOAN_PHAT', 9, 1, 3, 25, 4.20, '/api/v1/media/lesion_pt2_02.jpg'),
        (${t3Id}, ${dot3Id}, ${vt4Id}, '2026-11-03 23:00:00+07', 'TOAN_PHAT', 5, 4, 6, 2, 2.00, '/api/v1/media/lesion_pt4_01.jpg'),
        (${t4Id}, null, null, '2026-11-02 09:00:00+07', 'KHOI_PHAT', 7, 1, 2, 12, 2.80, '/api/v1/media/lesion_pt21_01.jpg');
    `);

    console.log('  tepdinhkem, dottonthuongda, vitritonthuong & anhchuptonthuong seeded.');
  }

  // =========================================================================
  // SECTION 14: Synchronize All Identity Sequences
  // =========================================================================
  console.log('\n🔹 Synchronizing identity sequences...');
  const identityTables = await prisma.$queryRawUnsafe(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND is_identity = 'YES';
  `);

  for (const it of identityTables) {
    try {
      await prisma.$executeRawUnsafe(`
        SELECT setval(pg_get_serial_sequence('"${it.table_name}"', '${it.column_name}'), coalesce(max("${it.column_name}"), 1))
        FROM "${it.table_name}";
      `);
    } catch (e) {
      // Some identity columns may not have sequences accessible via serial sequence
    }
  }
  console.log('  Sequences synchronized.');

  console.log('\n✅ Seeding completed successfully!');
}

seed()
  .catch(err => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
