import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

config();

const conn = process.env.CONNECTION_STRING;
const prisma = new PrismaClient({ datasources: { db: { url: conn } } });

const PASSWORD = process.env.SEED_DEMO_PASSWORD || 'MayDayDemo2026!';

const TEST_ACCOUNTS = [
  {
    roleName: 'admin',
    phone: '0901000001',
    fullName: 'Quản Trị Viên Test',
    gender: 'Nam',
  },
  {
    roleName: 'bac_si',
    phone: '0901000002',
    fullName: 'Bác Sĩ Test',
    gender: 'Nam',
  },
  {
    roleName: 'dieu_duong',
    phone: '0901000003',
    fullName: 'Điều Dưỡng Test',
    gender: 'Nu',
  },
  {
    roleName: 'benh_nhan',
    phone: '0901000004',
    fullName: 'Bệnh Nhân Test',
    gender: 'Nu',
  },
];

async function createOrUpdateAccount(accountDef, hashedPassword) {
  const { roleName, phone, fullName, gender } = accountDef;

  // 1. Find role
  const role = await prisma.vaitro.findUnique({
    where: { ten_vai_tro: roleName },
  });
  if (!role) {
    throw new Error(`Role "${roleName}" not found in database!`);
  }

  // 2. Find branch (for staff)
  const branch = await prisma.chinhanh.findFirst();
  if (!branch) {
    throw new Error('No branch found in database!');
  }

  // 3. Check if account already exists
  const existingAccount = await prisma.taikhoan.findFirst({
    where: {
      OR: [
        { ten_dang_nhap: phone },
        { nguoi: { so_dien_thoai: phone } },
      ],
    },
    include: {
      nguoi: true,
    },
  });

  if (existingAccount) {
    console.log(`Updating existing account for phone ${phone}...`);
    await prisma.taikhoan.update({
      where: { ma_tai_khoan: existingAccount.ma_tai_khoan },
      data: {
        ten_dang_nhap: phone,
        ma_vai_tro: role.ma_vai_tro,
        mat_khau_ma_hoa: hashedPassword,
        trang_thai_hoat_dong: true,
      },
    });

    await prisma.nguoi.update({
      where: { ma_nguoi: existingAccount.ma_nguoi },
      data: {
        ho_ten: fullName,
        so_dien_thoai: phone,
        gioi_tinh: gender,
      },
    });

    // Ensure subtype exists
    if (roleName === 'benh_nhan') {
      const bn = await prisma.benhnhan.findUnique({ where: { ma_benh_nhan: existingAccount.ma_nguoi } });
      if (!bn) {
        await prisma.benhnhan.create({ data: { ma_benh_nhan: existingAccount.ma_nguoi } });
      }
    } else {
      const nv = await prisma.nhanvien.findUnique({ where: { ma_nhan_vien: existingAccount.ma_nguoi } });
      if (!nv) {
        await prisma.nhanvien.create({ data: { ma_nhan_vien: existingAccount.ma_nguoi, ma_chi_nhanh: branch.ma_chi_nhanh } });
      }
    }

    return {
      status: 'UPDATED',
      phone,
      username: phone,
      role: role.ten_vai_tro,
      fullName,
    };
  }

  // 4. Create new account in a transaction
  return await prisma.$transaction(async (tx) => {
    // Create nguoi
    const person = await tx.nguoi.create({
      data: {
        ho_ten: fullName,
        so_dien_thoai: phone,
        gioi_tinh: gender,
        dia_chi_tinh_tp: 'Hà Nội',
        dia_chi_xa_phuong: 'Bách Khoa',
        dia_chi_so_nha_thon_pho: 'Số 1 Đại Cồ Việt',
      },
    });

    // Create subtype
    if (roleName === 'benh_nhan') {
      await tx.benhnhan.create({
        data: {
          ma_benh_nhan: person.ma_nguoi,
        },
      });
    } else {
      await tx.nhanvien.create({
        data: {
          ma_nhan_vien: person.ma_nguoi,
          ma_chi_nhanh: branch.ma_chi_nhanh,
        },
      });
    }

    // Create taikhoan
    const account = await tx.taikhoan.create({
      data: {
        ma_nguoi: person.ma_nguoi,
        ma_vai_tro: role.ma_vai_tro,
        ten_dang_nhap: phone,
        mat_khau_ma_hoa: hashedPassword,
        trang_thai_hoat_dong: true,
      },
    });

    return {
      status: 'CREATED',
      phone,
      username: account.ten_dang_nhap,
      role: role.ten_vai_tro,
      fullName: person.ho_ten,
    };
  });
}

async function main() {
  console.log('🚀 Connecting to Cloud PostgreSQL...');
  await prisma.$connect();
  console.log('🔒 Generating bcrypt password hash...');
  const hashedPassword = await hash(PASSWORD, 12);

  console.log(`🔑 Password for all test accounts will be: "${PASSWORD}"\n`);

  const results = [];
  for (const acc of TEST_ACCOUNTS) {
    const res = await createOrUpdateAccount(acc, hashedPassword);
    results.push(res);
    console.log(`✅ [${res.status}] Role: ${res.role.padEnd(12)} | Phone / User: ${res.phone} | Name: ${res.fullName}`);
  }

  console.log('\n🎉 All test accounts are ready in the Cloud Database!');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
