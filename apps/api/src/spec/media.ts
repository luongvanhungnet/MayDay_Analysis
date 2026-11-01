import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { basename, resolve, sep } from 'node:path';
import { PrismaService } from '../common/prisma.service';
import { DomainException } from '../common/domain.exception';
import { NativeService } from '../native/native.service';
import { Actor } from '../native/schema';
import { Upload } from './contract';
import { body, id, input, key, output } from './resources';

export class Media {
  readonly directory=resolve(process.env.UPLOAD_DIR??resolve(__dirname,'../../../../.data/uploads'));
  constructor(private readonly native: NativeService,private readonly db: PrismaService) {}
  async upload(actor: Actor, raw: unknown, file?: Upload) {
    const b=file?.buffer;
    const jpeg=!!b&&b.length>=4&&b[0]===255&&b[1]===216&&b[2]===255;
    const png=!!b&&b.length>=24&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const webp=!!b&&b.length>=12&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';
    const mime=jpeg?'image/jpeg':png?'image/png':webp?'image/webp':null;
    if(!file||!b||!mime||mime!==file.mimetype||b.length>8*1024*1024)throw new DomainException(6003,'Cần ảnh JPEG/PNG/WebP hợp lệ, tối đa 8 MiB');
    const data=body(raw),allowed=['medical_record_id','purpose','description'];
    for(const k of Object.keys(data))if(!allowed.includes(k))throw new DomainException(2003,`Trường upload ${k} không hỗ trợ`);
    const recordId=id(data.medical_record_id);
    await this.native.detail(actor,'hosobenhan',key('records',recordId));
    const fileName=randomUUID()+(jpeg?'.jpg':png?'.png':'.webp');
    const originalName=basename(file.originalname.replace(/\\/g,'/')).replace(/[\x00-\x1f\x7f]/g,'').slice(0,255)||fileName;
    if(data.purpose!==undefined&&(typeof data.purpose!=='string'||data.purpose.length>100))throw new DomainException(2003,'purpose không hợp lệ');
    if(data.description!==undefined&&(typeof data.description!=='string'||data.description.length>100000))throw new DomainException(2003,'description không hợp lệ');
    await mkdir(this.directory,{recursive:true});
    const path=resolve(this.directory,fileName);
    await writeFile(path,b,{flag:'wx',mode:0o600});
    try {
      const row=await this.db.tepdinhkem.create({data:{ma_ho_so:BigInt(recordId),ma_tai_khoan:BigInt(actor.accountId),ten_tep_goc:originalName,duong_dan_luu_tru:fileName,dinh_dang_tep:mime,loai_phuong_tien:'image',dung_luong_byte:BigInt(b.length),phan_loai_muc_dich:data.purpose as string|undefined,mo_ta_tep:data.description as string|undefined}});
      return {...output('files',row),url:`/api/v1/image-attachments/${row.ma_tep_dinh_kem}/content`};
    } catch(error) {await unlink(path).catch(()=>{});throw error;}
  }
  async files(actor: Actor, value: unknown, raw: Record<string,unknown>) {
    const userId=id(value);
    if(actor.role!=='admin'&&userId!==actor.accountId)throw new DomainException(3106,'Chỉ xem tệp đã tải lên của mình',403);
    const page=Math.max(1,Math.trunc(Number(raw.page)||1)),limit=Math.min(100,Math.max(1,Math.trunc(Number(raw.limit)||25)));
    const where={ma_tai_khoan:BigInt(userId)};
    const [rows,total]=await this.db.$transaction([this.db.tepdinhkem.findMany({where,orderBy:{ma_tep_dinh_kem:'desc'},take:limit,skip:(page-1)*limit}),this.db.tepdinhkem.count({where})]);
    return {data:rows.map(row=>({...output('files',row),url:`/api/v1/image-attachments/${row.ma_tep_dinh_kem}/content`})),meta:{page,limit,total,total_pages:Math.ceil(total/limit)}};
  }
  private localPath(path: string) {
    // Imported metadata may reference remote storage. Never read/delete an arbitrary stored path.
    if(!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(path))throw new DomainException(5010,'Tệp này thuộc kho lưu trữ cũ, chưa cấu hình bộ đọc tương ứng',501);
    const target=resolve(this.directory,path);
    if(!target.startsWith(this.directory+sep))throw new DomainException(2003,'Đường dẫn tệp không hợp lệ');
    return target;
  }
  async content(actor: Actor, value: unknown) {
    const row=await this.native.detail(actor,'tepdinhkem',key('files',value));
    const path=this.localPath(String(row.duong_dan_luu_tru));
    try {return {buffer:await readFile(path),mime:String(row.dinh_dang_tep),name:String(row.ten_tep_goc)};}
    catch {throw new DomainException(4004,'Không tìm thấy nội dung tệp',404);}
  }
  async remove(actor: Actor, value: unknown) {
    const row=await this.native.detail(actor,'tepdinhkem',key('files',value));
    if(actor.role!=='admin'&&String(row.ma_tai_khoan)!==actor.accountId)throw new DomainException(3106,'Chỉ xóa tệp đã tải lên của mình',403);
    const path=this.localPath(String(row.duong_dan_luu_tru));
    await this.db.tepdinhkem.delete({where:{ma_tep_dinh_kem:BigInt(id(value))}});
    let pending=false;
    await unlink(path).catch((error: NodeJS.ErrnoException)=>{if(error.code!=='ENOENT')pending=true;});
    return {deleted:true,...(pending?{storage_cleanup_pending:true}:{})};
  }
  async photo(actor: Actor, raw: unknown) {
    const data=input('photos',raw);
    if(!data.ma_tep_dinh_kem)throw new DomainException(2003,'Thiếu attachment_id');
    const file=await this.native.detail(actor,'tepdinhkem',key('files',data.ma_tep_dinh_kem));
    if(data.ma_vi_tri_ton_thuong){
      const location=await this.native.detail(actor,'vitritonthuong',key('locations',data.ma_vi_tri_ton_thuong));
      if(data.ma_dot_ton_thuong_da&&id(data.ma_dot_ton_thuong_da)!==String(location.ma_dot_ton_thuong_da))throw new DomainException(2003,'Vị trí không thuộc đợt tổn thương');
      data.ma_dot_ton_thuong_da=String(location.ma_dot_ton_thuong_da);
    }
    if(!data.ma_dot_ton_thuong_da)throw new DomainException(2003,'Thiếu episode_id hoặc location_id');
    const episode=await this.native.detail(actor,'dottonthuongda',key('episodes',data.ma_dot_ton_thuong_da));
    const record=await this.native.detail(actor,'hosobenhan',key('records',file.ma_ho_so));
    if(String(record.ma_benh_nhan)!==String(episode.ma_benh_nhan)||
      (episode.ma_ho_so_man&&String(episode.ma_ho_so_man)!==String(file.ma_ho_so)))throw new DomainException(3106,'Ảnh và tổn thương phải cùng bệnh nhân/bệnh án',403);
    if(data.moc_tien_trien!==undefined)this.milestoneValue(data.moc_tien_trien);
    return output('photos',await this.native.create(actor,'anhchuptonthuong',data));
  }
  milestoneValue(value: unknown) {
    if(!['start','peak','normal'].includes(String(value)))throw new DomainException(7006,'milestone phải là start, peak hoặc normal');
    return String(value);
  }
  async milestone(actor: Actor, value: unknown, raw: unknown) {
    const data=body(raw);
    if(Object.keys(data).length!==1||!('milestone' in data))throw new DomainException(2003,'Chỉ nhận trường milestone');
    return output('photos',await this.native.update(actor,'anhchuptonthuong',key('photos',value),{moc_tien_trien:this.milestoneValue(data.milestone)}));
  }
}
