import { DomainException } from '../common/domain.exception';
import { choices, table, writableData } from '../native/schema';
import { idInput, objectInput } from './contract';

type Resource = { table: string; pk: string; fields: Record<string,string> };
export const resources: Record<string, Resource> = {
  branches: {table:'chinhanh',pk:'ma_chi_nhanh',fields:{name:'ten_chi_nhanh',address:'dia_chi',phone:'so_dien_thoai',is_active:'trang_thai'}},
  departments: {table:'khoaphong',pk:'ma_khoa_phong',fields:{name:'ten_khoa_phong',type:'loai_khoa',description:'mo_ta',branch_id:'ma_chi_nhanh'}},
  rooms: {table:'phongkham',pk:'ma_phong_kham',fields:{name:'ten_phong_kham',department_id:'ma_khoa_phong'}},
  roles: {table:'vaitro',pk:'ma_vai_tro',fields:{name:'ten_vai_tro',display_name:'ten_hien_thi',description:'mo_ta_vai_tro'}},
  permissions: {table:'quyenhan',pk:'ma_quyen_han',fields:{name:'ten_quyen_han',group:'nhom_quyen',description:'mo_ta'}},
  users: {table:'taikhoan',pk:'ma_tai_khoan',fields:{person_id:'ma_nguoi',role_id:'ma_vai_tro',username:'ten_dang_nhap',is_active:'trang_thai_hoat_dong'}},
  people: {table:'nguoi',pk:'ma_nguoi',fields:{full_name:'ho_ten',date_of_birth:'ngay_sinh',gender:'gioi_tinh',phone:'so_dien_thoai',province:'dia_chi_tinh_tp',ward:'dia_chi_xa_phuong',address:'dia_chi_so_nha_thon_pho'}},
  patients: {table:'benhnhan',pk:'ma_benh_nhan',fields:{his_id:'ma_his',occupation:'nghe_nghiep',ethnicity:'dan_toc',insurance_number:'bhyt_so_the',insurance_expiry:'bhyt_gia_tri_den',relative_name_address:'nguoi_nha_ho_ten_dia_chi',relative_phone:'nguoi_nha_so_dien_thoai'}},
  records: {table:'hosobenhan',pk:'ma_ho_so',fields:{patient_id:'ma_benh_nhan',record_type:'loai_benh_an',status:'trang_thai',first_exam_at:'thoi_diem_kham_lan_dau',treatment_start:'ngay_bat_dau_dieu_tri_ngoai_tru',treatment_end:'ngay_ket_thuc_dieu_tri_ngoai_tru',previous_diagnosis:'chan_doan_tuyen_truoc',initial_diagnosis:'chan_doan_ban_dau_phong_kham',onset_weeks:'thoi_gian_khoi_phat_tuan'}},
  scores: {table:'nhatkyuashangngay',pk:'ma_nhat_ky_uas',fields:{patient_id:'ma_benh_nhan',medical_record_id:'ma_ho_so_man',cycle_id:'ma_chu_ky',score_date:'ngay_cham_diem',day_in_cycle:'ngay_thu_may_trong_chu_ky',hss_score:'diem_san_phu_hss',iss_score:'diem_ngua_iss',medication_status:'trang_thai_dung_thuoc'}},
  episodes: {table:'dottonthuongda',pk:'ma_dot_ton_thuong_da',fields:{patient_id:'ma_benh_nhan',medical_record_id:'ma_ho_so_man',name:'ten_dot_ton_thuong_da',onset_at:'thoi_diem_xuat_hien',context:'hoan_canh_xuat_hien',other_context:'hoan_canh_xuat_hien_khac',medication_name:'ten_thuoc_dung_gan_thoi_diem_xuat_hien',description:'chi_tiet_dot_ton_thuong'}},
  locations: {table:'vitritonthuong',pk:'ma_vi_tri_ton_thuong',fields:{episode_id:'ma_dot_ton_thuong_da',body_location:'vi_tri_co_the',onset_at:'thoi_diem_xuat_hien',medication_name:'ten_thuoc_lien_quan',context:'hoan_canh_xuat_hien',other_context:'hoan_canh_xuat_hien_khac'}},
  photos: {table:'anhchuptonthuong',pk:'ma_anh',fields:{image_id:'ma_tep_dinh_kem',attachment_id:'ma_tep_dinh_kem',episode_id:'ma_dot_ton_thuong_da',location_id:'ma_vi_tri_ton_thuong',taken_at:'thoi_diem_chup',milestone:'moc_tien_trien',itch_score:'diem_ngua_nrs',pain_score:'diem_dau_nrs',burning_score:'diem_bong_rat_nrs',wheal_count:'so_luong_not_san'}},
  files: {table:'tepdinhkem',pk:'ma_tep_dinh_kem',fields:{medical_record_id:'ma_ho_so',user_id:'ma_tai_khoan',file_name:'ten_tep_goc',mime_type:'dinh_dang_tep',size:'dung_luong_byte',purpose:'phan_loai_muc_dich',description:'mo_ta_tep'}},
};
export function id(value: unknown): string {
  const parsed = idInput.safeParse(typeof value==='bigint'?String(value):value);
  if (!parsed.success) throw new DomainException(2003,'Mã bản ghi không hợp lệ');
  return parsed.data;
}
export function body(value: unknown): Record<string,unknown> {
  const parsed=objectInput.safeParse(value);
  if(!parsed.success) throw new DomainException(2003,'Body phải là một đối tượng JSON');
  return parsed.data;
}
export function key(resource: string, value: unknown) {
  return JSON.stringify({[resources[resource].pk]:id(value)});
}
export function input(resource: string, raw: unknown, update=false) {
  const r=resources[resource], data: Record<string,unknown>={};
  for(const [name,value] of Object.entries(body(raw))) {
    const target=r.fields[name]??name;
    if(!table(r.table).columns.some(c=>c.name===target))
      throw new DomainException(2003,`Trường ${name} không có ánh xạ lưu trữ trong ${r.table}`);
    if(target in data) throw new DomainException(2003,`Trùng trường ${target}`);
    data[target]=target==='gioi_tinh'?({male:'Nam',female:'Nu'}[String(value)]??value):value;
  }
  if(resource==='roles'&&!update&&data.ten_hien_thi===undefined&&data.ten_vai_tro!==undefined)data.ten_hien_thi=data.ten_vai_tro;
  const t=table(r.table),validated=writableData(t,data,update);
  for(const [name,value] of Object.entries(validated)) {
    const options=choices(t,t.columns.find(c=>c.name===name)!);
    if(value!==null&&options.length&&!options.includes(String(value)))throw new DomainException(2003,`${name}: chọn một trong ${options.join(', ')}`);
  }
  return validated;
}
export function output(resource: string, row: Record<string,unknown>) {
  const r=resources[resource];
  const result: Record<string,unknown>={};
  const aliases=Object.fromEntries(Object.entries(r.fields).map(([a,b])=>[b,a]));
  for(const [k,v] of Object.entries(row)) {
    if(k==='mat_khau_ma_hoa'||k==='_key'||k==='_label'||k==='duong_dan_luu_tru')continue;
    result[k===r.pk?'id':aliases[k]??({thoi_diem_tao:'created_at',thoi_diem_cap_nhat:'updated_at'}[k]??k)] =
      typeof v==='bigint'?String(v):v;
  }
  return result;
}
export function query(resource: string, raw: Record<string,unknown>, forced: Record<string,unknown>={}) {
  const r=resources[resource];
  const filters: Record<string,unknown>={};
  for(const [name,value] of Object.entries(raw)) {
    if(['page','limit','search','q'].includes(name))continue;
    if(name==='filter'){
      let parsed: unknown;
      try { parsed=JSON.parse(String(value)); } catch {throw new DomainException(2003,'Bộ lọc không hợp lệ');}
      Object.assign(filters,body(parsed));
    } else filters[name]=value;
  }
  const mapped: Record<string,unknown>={};
  for(const [name,value] of Object.entries({...filters,...forced})) {
    const col=name==='id'?r.pk:r.fields[name]??name;
    if(col==='mat_khau_ma_hoa'||!table(r.table).columns.some(c=>c.name===col))throw new DomainException(2003,`Bộ lọc ${name} không hợp lệ`);
    mapped[col]=value;
  }
  // Forced ownership/reference filters must win even when a caller supplies native aliases.
  for(const [name,value] of Object.entries(forced))mapped[r.fields[name]??name]=value;
  return {page:raw.page,limit:raw.limit,search:raw.search??raw.q,filter:JSON.stringify(mapped)};
}
