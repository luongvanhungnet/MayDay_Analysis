import { Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { PrismaService } from '../common/prisma.service';
import { DomainException } from '../common/domain.exception';
import { NativeService } from '../native/native.service';
import { Actor } from '../native/schema';
import { idInput } from './contract';
import { body, id, input, key, output } from './resources';

const password=z.string().min(10).refine(v=>Buffer.byteLength(v)<=72,'Mật khẩu tối đa 72 byte');
const registration=z.object({
  full_name:z.string().trim().min(1).max(150),phone:z.string().regex(/^\d{10}$/),password,
  username:z.string().trim().min(1).max(100).optional(),
  gender:z.enum(['male','female','Nam','Nu']).optional(),date_of_birth:z.string().optional(),
  province:z.string().max(100).optional(),ward:z.string().max(100).optional(),address:z.string().max(255).optional(),
}).strict();
const administrative=registration.extend({role_id:idInput.optional(),branch_id:idInput.optional(),is_active:z.boolean().optional()});
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed=schema.safeParse(value);
  if(!parsed.success)throw new DomainException(2003,parsed.error.issues.map(e=>`${e.path.join('.')||'body'}: ${e.message}`).join('; '));
  return parsed.data;
}
export class Accounts {
  constructor(private readonly native: NativeService,private readonly db: PrismaService) {}
  async register(raw: unknown, kind:'signup'|'staff'|'userCreate') {
    const data=kind==='signup'?parse(registration,raw):parse(administrative,raw);
    const privileged=data as z.infer<typeof administrative>;
    const encoded=await hash(data.password,12);
    return this.db.$transaction(async tx=>{
      // Phone is not unique in the imported schema. Serialize API registration by phone.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${data.phone},0))`;
      const duplicate=await tx.nguoi.findFirst({where:{so_dien_thoai:data.phone,taikhoan:{isNot:null}}});
      if(duplicate)throw new DomainException(2003,'Số điện thoại đã có tài khoản',409);
      const role=kind==='signup'||!privileged.role_id
        ? await tx.vaitro.findUnique({where:{ten_vai_tro:kind==='staff'?'bac_si':'benh_nhan'}})
        : await tx.vaitro.findUnique({where:{ma_vai_tro:BigInt(privileged.role_id)}});
      if(!role)throw new DomainException(2003,'Vai trò không tồn tại');
      if(kind==='staff'&&role.ten_vai_tro==='benh_nhan')throw new DomainException(2003,'Chọn vai trò nhân viên');
      if(role.ten_vai_tro!=='benh_nhan'&&!privileged.branch_id)throw new DomainException(2003,'Nhân viên cần branch_id');
      if(privileged.branch_id&&!await tx.chinhanh.findUnique({where:{ma_chi_nhanh:BigInt(privileged.branch_id)}}))throw new DomainException(2003,'Chi nhánh không tồn tại');
      const person=input('people',Object.fromEntries(Object.entries(data).filter(([k])=>!['password','username','role_id','branch_id','is_active'].includes(k))));
      const row=await tx.nguoi.create({data:{ho_ten:String(person.ho_ten),so_dien_thoai:data.phone,
        gioi_tinh:person.gioi_tinh as string|undefined,ngay_sinh:person.ngay_sinh?new Date(String(person.ngay_sinh)):undefined,
        dia_chi_tinh_tp:person.dia_chi_tinh_tp as string|undefined,dia_chi_xa_phuong:person.dia_chi_xa_phuong as string|undefined,dia_chi_so_nha_thon_pho:person.dia_chi_so_nha_thon_pho as string|undefined}});
      if(role.ten_vai_tro==='benh_nhan')await tx.benhnhan.create({data:{ma_benh_nhan:row.ma_nguoi}});
      else await tx.nhanvien.create({data:{ma_nhan_vien:row.ma_nguoi,ma_chi_nhanh:BigInt(privileged.branch_id!)}});
      const account=await tx.taikhoan.create({data:{ma_nguoi:row.ma_nguoi,ma_vai_tro:role.ma_vai_tro,ten_dang_nhap:data.username??data.phone,mat_khau_ma_hoa:encoded,trang_thai_hoat_dong:privileged.is_active??true}});
      return {user_id:String(account.ma_tai_khoan),person_id:String(row.ma_nguoi),full_name:row.ho_ten,phone:row.so_dien_thoai,gender:row.gioi_tinh,role_id:String(role.ma_vai_tro),is_active:account.trang_thai_hoat_dong,created_at:account.thoi_diem_tao};
    });
  }
  async profile(actor: Actor) {
    const account=await this.native.profile(actor);
    const person=await this.native.detail(actor,'nguoi',key('people',actor.personId));
    const patient=await this.db.benhnhan.findUnique({where:{ma_benh_nhan:BigInt(actor.personId)}});
    return {...output('people',person),...account,patient:patient?output('patients',patient):null};
  }
  async profileUpdate(actor: Actor, raw: unknown) {
    const data=body(raw),patientFields=Object.keys(data).filter(k=>['occupation','ethnicity','insurance_number','insurance_expiry','relative_name_address','relative_phone'].includes(k));
    const patient=input('patients',Object.fromEntries(patientFields.map(k=>[k,data[k]])),true);
    const person=input('people',Object.fromEntries(Object.entries(data).filter(([k])=>!patientFields.includes(k))),true);
    // Scope every write to the authenticated person, never a caller-supplied user_id.
    await this.db.$transaction(async tx=>{
      if(Object.keys(person).length)await tx.nguoi.update({where:{ma_nguoi:BigInt(actor.personId)},data:{
        ...(person as Prisma.nguoiUpdateInput),
        ...(person.ngay_sinh?{ngay_sinh:new Date(String(person.ngay_sinh))}:{}),
      }});
      if(Object.keys(patient).length)await tx.benhnhan.update({where:{ma_benh_nhan:BigInt(actor.personId)},data:{
        ...(patient as Prisma.benhnhanUpdateInput),
        ...(patient.bhyt_gia_tri_den?{bhyt_gia_tri_den:new Date(String(patient.bhyt_gia_tri_den))}:{}),
      }});
    });
    return this.profile(actor);
  }
  async userUpdate(actor: Actor, value: unknown, raw: unknown) {
    const userId=id(value),data=body(raw);
    // Profile and privilege changes share one transaction so failures cannot leave a partial edit.
    return this.db.$transaction(async tx=>{
      const current=await tx.taikhoan.findUnique({where:{ma_tai_khoan:BigInt(userId)}});
      if(!current)throw new DomainException(4004,'Không tìm thấy tài khoản',404);
      if(userId===actor.accountId&&((data.role_id!==undefined&&id(data.role_id)!==String(current.ma_vai_tro))||data.is_active===false))throw new DomainException(2003,'Không thể tự khóa hoặc đổi vai trò quản trị');
      const allowed=z.object({full_name:z.string().trim().min(1).max(150).optional(),phone:z.string().regex(/^\d{10}$/).optional(),gender:z.enum(['male','female','Nam','Nu']).optional(),role_id:idInput.optional(),is_active:z.boolean().optional(),password:password.optional(),username:z.string().min(1).max(100).optional()}).strict();
      const parsed=parse(allowed,data);
      if(parsed.role_id){
        const role=await tx.vaitro.findUnique({where:{ma_vai_tro:BigInt(parsed.role_id)}});
        if(!role)throw new DomainException(2003,'Vai trò không tồn tại');
        const subtype=role.ten_vai_tro==='benh_nhan'?await tx.benhnhan.findUnique({where:{ma_benh_nhan:current.ma_nguoi}}):await tx.nhanvien.findUnique({where:{ma_nhan_vien:current.ma_nguoi}});
        if(!subtype)throw new DomainException(2003,'Người này chưa có hồ sơ bệnh nhân/nhân viên phù hợp với vai trò');
      }
      const person=input('people',Object.fromEntries(Object.entries(parsed).filter(([k])=>['full_name','phone','gender'].includes(k))),true);
      if(Object.keys(person).length)await tx.nguoi.update({where:{ma_nguoi:current.ma_nguoi},data:person as Prisma.nguoiUpdateInput});
      const account=await tx.taikhoan.update({where:{ma_tai_khoan:BigInt(userId)},data:{
        ma_vai_tro:parsed.role_id?BigInt(parsed.role_id):undefined,trang_thai_hoat_dong:parsed.is_active,
        ten_dang_nhap:parsed.username,mat_khau_ma_hoa:parsed.password?await hash(parsed.password,12):undefined,
      }});
      return output('users',account);
    });
  }
  async assign(value: unknown, raw: unknown) {
    const data=parse(z.object({branch_id:idInput}).strict(),raw);
    const account=await this.db.taikhoan.findUnique({where:{ma_tai_khoan:BigInt(id(value))}});
    if(!account)throw new DomainException(4004,'Không tìm thấy tài khoản',404);
    const employee=await this.db.nhanvien.update({where:{ma_nhan_vien:account.ma_nguoi},data:{ma_chi_nhanh:BigInt(data.branch_id)}});
    return {user_id:id(value),person_id:String(employee.ma_nhan_vien),branch_id:String(employee.ma_chi_nhanh)};
  }
}
