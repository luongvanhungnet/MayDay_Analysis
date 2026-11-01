import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../common/prisma.service';
import { DomainException } from '../common/domain.exception';
import { NativeService } from '../native/native.service';
import { Actor } from '../native/schema';
import { parse } from './accounts';
import { body, id, input, key, output } from './resources';

export class Clinical {
  constructor(private readonly native: NativeService,private readonly db: PrismaService) {}
  async create(actor: Actor, raw: unknown) {
    const data=input('records',raw);
    if(actor.role==='benh_nhan') {
      if(data.ma_benh_nhan!==undefined&&id(data.ma_benh_nhan)!==actor.personId)throw new DomainException(3106,'Chỉ tạo bệnh án cho chính mình',403);
      data.ma_benh_nhan=actor.personId;
    }
    if(!['admin','bac_si','dieu_duong','benh_nhan'].includes(actor.role))throw new DomainException(3101,'Không có quyền tạo bệnh án',403);
    if(!data.ma_benh_nhan)throw new DomainException(2003,'Thiếu patient_id');
    if(!['CAP','MAN'].includes(String(data.loai_benh_an)))throw new DomainException(2003,'record_type phải là CAP hoặc MAN');
    if(data.trang_thai!==undefined&&data.trang_thai!=='pending')throw new DomainException(2003,'Bệnh án mới phải ở trạng thái pending');
    data.trang_thai='pending';
    // The dedicated route grants only creation of this validated parent/subtype pair.
    // Patient identity is fixed above; no arbitrary table name or privileged input is accepted.
    const writer=actor.role==='admin'||actor.role==='bac_si'?actor:{...actor,role:'bac_si'};
    return output('records',await this.native.create(writer,'hosobenhan',data));
  }
  async accept(actor: Actor, value: unknown) {
    if(!['admin','bac_si'].includes(actor.role))throw new DomainException(3101,'Chỉ bác sĩ tiếp nhận bệnh án',403);
    const recordId=BigInt(id(value));
    return this.db.$transaction(async tx=>{
      const rows=await tx.$queryRaw<{trang_thai:string;loai_benh_an:string}[]>`SELECT trang_thai,loai_benh_an FROM hosobenhan WHERE ma_ho_so=${recordId} FOR UPDATE`;
      const record=rows[0];
      if(!record)throw new DomainException(4004,'Không tìm thấy bệnh án',404);
      if(record.trang_thai!=='pending')throw new DomainException(2003,'Bệnh án không ở trạng thái chờ tiếp nhận',409);
      const doctor=await tx.nhanvien.findUnique({where:{ma_nhan_vien:BigInt(actor.personId)}});
      if(!doctor)throw new DomainException(3101,'Tài khoản chưa có hồ sơ nhân viên',403);
      const aggregate=await tx.phienkham.aggregate({where:{ma_ho_so:recordId},_max:{lan_kham_thu:true}});
      const visit=await tx.phienkham.create({data:{ma_ho_so:recordId,ma_bac_si:BigInt(actor.personId),loai_benh_an:record.loai_benh_an,ngay_kham:new Date(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())),lan_kham_thu:(aggregate._max.lan_kham_thu??0)+1}});
      // Prisma introspection describes the generated discriminator as a default;
      // insert only the key so PostgreSQL, rather than Prisma, computes it.
      if(record.loai_benh_an==='CAP')await tx.$executeRaw`INSERT INTO phienkhamcap (ma_phien_kham) VALUES (${visit.ma_phien_kham})`;
      else await tx.$executeRaw`INSERT INTO phienkhamman (ma_phien_kham) VALUES (${visit.ma_phien_kham})`;
      await tx.hosobenhan.update({where:{ma_ho_so:recordId},data:{trang_thai:'in_progress'}});
      return {id:String(recordId),status:'in_progress',assigned_doctor_id:actor.personId,visit_id:String(visit.ma_phien_kham)};
    });
  }
  async complete(actor: Actor, value: unknown, raw: unknown) {
    if(!['admin','bac_si'].includes(actor.role))throw new DomainException(3101,'Chỉ bác sĩ chốt bệnh án',403);
    const data=parse(z.object({instructions:z.string().max(100000)}).strict(),raw),recordId=BigInt(id(value));
    return this.db.$transaction(async tx=>{
      const rows=await tx.$queryRaw<{trang_thai:string}[]>`SELECT trang_thai FROM hosobenhan WHERE ma_ho_so=${recordId} FOR UPDATE`;
      if(!rows.length)throw new DomainException(4004,'Không tìm thấy bệnh án',404);
      if(rows[0].trang_thai!=='in_progress')throw new DomainException(2003,'Bệnh án không trong quá trình khám',409);
      const visit=await this.assignedVisit(actor,recordId,tx);
      await tx.phienkham.update({where:{ma_phien_kham:visit.ma_phien_kham},data:{dan_do:data.instructions}});
      await tx.hosobenhan.update({where:{ma_ho_so:recordId},data:{trang_thai:'completed'}});
      return {id:String(recordId),status:'completed',instructions:data.instructions};
    });
  }
  async assignedVisit(actor: Actor, recordId: bigint, tx: Prisma.TransactionClient=this.db) {
    const visit=await tx.phienkham.findFirst({where:{ma_ho_so:recordId},orderBy:[{lan_kham_thu:'desc'},{ma_phien_kham:'desc'}]});
    if(!visit)throw new DomainException(2003,'Bệnh án chưa được tiếp nhận',409);
    if(String(visit.ma_bac_si)!==actor.personId)throw new DomainException(3106,'Chỉ bác sĩ phụ trách được thực hiện',403);
    return visit;
  }
  async summary(actor: Actor, value: unknown) {
    const record=await this.native.detail(actor,'hosobenhan',key('records',value));
    const visit=await this.db.phienkham.findFirst({where:{ma_ho_so:BigInt(id(value))},orderBy:[{lan_kham_thu:'desc'},{ma_phien_kham:'desc'}],select:{ma_phien_kham:true,ma_bac_si:true,ngay_kham:true,dan_do:true}});
    return {...output('records',record),latest_visit:visit?{id:String(visit.ma_phien_kham),assigned_doctor_id:String(visit.ma_bac_si),date:visit.ngay_kham,instructions:visit.dan_do}:null};
  }
  async eligibility(actor: Actor) {
    if(actor.role!=='benh_nhan')throw new DomainException(3101,'Chức năng dành cho bệnh nhân',403);
    const records=await this.db.hosobenhan.findMany({where:{ma_benh_nhan:BigInt(actor.personId),loai_benh_an:'MAN',trang_thai:{in:['pending','in_progress','completed']}},select:{ma_ho_so:true},orderBy:{ma_ho_so:'desc'}});
    return {eligible:records.length>0,medical_record_ids:records.map(r=>String(r.ma_ho_so))};
  }
  async score(actor: Actor, raw: unknown) {
    if(actor.role!=='benh_nhan')throw new DomainException(3101,'Chỉ bệnh nhân ghi nhật ký điểm',403);
    const data=input('scores',raw);
    if(data.ma_benh_nhan!==undefined&&id(data.ma_benh_nhan)!==actor.personId)throw new DomainException(3106,'Chỉ chấm điểm cho chính mình',403);
    data.ma_benh_nhan=actor.personId;
    const scoreDate=String(data.ngay_cham_diem??new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    if(scoreDate!==today)throw new DomainException(2003,'Chỉ được ghi điểm cho ngày hôm nay');
    data.ngay_cham_diem=scoreDate;
    for(const f of ['diem_san_phu_hss','diem_ngua_iss'])if(!Number.isInteger(Number(data[f]))||Number(data[f])<0||Number(data[f])>3)throw new DomainException(2003,'Điểm HSS và ISS phải là số nguyên từ 0 đến 3');
    return this.db.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${actor.personId+':'+today},0))`;
      const record=await tx.hosobenhan.findFirst({where:{ma_benh_nhan:BigInt(actor.personId),loai_benh_an:'MAN',trang_thai:{in:['pending','in_progress','completed']},...(data.ma_ho_so_man?{ma_ho_so:BigInt(id(data.ma_ho_so_man))}:{})},orderBy:{ma_ho_so:'desc'}});
      if(!record)throw new DomainException(2003,'Chưa có bệnh án mạn hợp lệ',409);
      const duplicate=await tx.nhatkyuashangngay.findFirst({where:{ma_benh_nhan:BigInt(actor.personId),ngay_cham_diem:new Date(today)}});
      if(duplicate)throw new DomainException(2003,'Đã ghi điểm cho ngày hôm nay',409);
      if(data.ma_chu_ky){
        const cycle=await tx.chukytheodoiuas7.findUnique({where:{ma_chu_ky:BigInt(id(data.ma_chu_ky))}});
        if(!cycle||String(cycle.ma_benh_nhan)!==actor.personId)throw new DomainException(3106,'Chu kỳ không thuộc bệnh nhân',403);
        const day=Math.floor((Date.parse(today)-cycle.ngay_bat_dau.getTime())/86400000)+1;
        if(day<1||day>7||new Date(today)>cycle.ngay_ket_thuc)throw new DomainException(2003,'Ngày chấm điểm ngoài chu kỳ');
        if(data.ngay_thu_may_trong_chu_ky!==undefined&&Number(data.ngay_thu_may_trong_chu_ky)!==day)throw new DomainException(2003,'Ngày trong chu kỳ không khớp');
        data.ngay_thu_may_trong_chu_ky=day;
      } else if(data.ngay_thu_may_trong_chu_ky!==undefined)throw new DomainException(2003,'Thiếu cycle_id');
      const row=await tx.nhatkyuashangngay.create({data:{ma_benh_nhan:BigInt(actor.personId),ma_ho_so_man:record.ma_ho_so,ngay_cham_diem:new Date(today),diem_san_phu_hss:Number(data.diem_san_phu_hss),diem_ngua_iss:Number(data.diem_ngua_iss),ma_chu_ky:data.ma_chu_ky?BigInt(id(data.ma_chu_ky)):undefined,ngay_thu_may_trong_chu_ky:data.ngay_thu_may_trong_chu_ky===undefined?undefined:Number(data.ngay_thu_may_trong_chu_ky),trang_thai_dung_thuoc:data.trang_thai_dung_thuoc as string|undefined}});
      return {...output('scores',row),uas_score:row.diem_uas_ngay};
    });
  }
  async prescribe(actor: Actor, raw: unknown) {
    if(!['admin','bac_si'].includes(actor.role))throw new DomainException(3101,'Chỉ bác sĩ kê đơn',403);
    const data=parse(z.object({medical_record_id:z.union([z.string(),z.number()]).transform(id),notes:z.string().max(100000).optional(),medicines:z.array(z.object({medicine_id:z.string().max(50).optional(),name:z.string().trim().min(1).max(255).optional(),dosage:z.string().trim().min(1).max(100),duration:z.string().trim().min(1).max(100)}).strict().refine(m=>!!m.medicine_id||!!m.name,'Cần tên hoặc mã thuốc')).min(1).max(100)}).strict(),raw);
    return this.db.$transaction(async tx=>{
      const rows=await tx.$queryRaw<{trang_thai:string}[]>`SELECT trang_thai FROM hosobenhan WHERE ma_ho_so=${BigInt(data.medical_record_id)} FOR UPDATE`;
      if(!rows.length)throw new DomainException(4004,'Không tìm thấy bệnh án',404);
      if(rows[0].trang_thai!=='in_progress')throw new DomainException(2003,'Chỉ kê đơn khi đang khám',409);
      const visit=await this.assignedVisit(actor,BigInt(data.medical_record_id),tx);
      const prescription=await tx.donthuoc.create({data:{ma_ho_so:BigInt(data.medical_record_id),ma_phien_kham:visit.ma_phien_kham,ghi_chu_dieu_tri:data.notes}});
      for(const medicine of data.medicines)await tx.chitietdonthuoc.create({data:{ma_don_thuoc:prescription.ma_don_thuoc,ma_thuoc:medicine.medicine_id,ten_thuoc_bo_sung:medicine.name,lieu_dung:medicine.dosage,thoi_gian_dung:medicine.duration}});
      return {id:String(prescription.ma_don_thuoc),medical_record_id:data.medical_record_id,visit_id:String(visit.ma_phien_kham),medicines:data.medicines};
    });
  }
}
