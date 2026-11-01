import { HttpException, Injectable } from '@nestjs/common';
import { NativeService } from '../native/native.service';
import { PrismaService } from '../common/prisma.service';
import { DomainException } from '../common/domain.exception';
import { idInput, SpecHandler, SpecRequest, SpecResult } from './contract';
import { Actor } from '../native/schema';
import { body, id, input, key, output, query, resources } from './resources';
import { Accounts, parse } from './accounts';
import { Clinical } from './clinical';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { Media } from './media';

@Injectable()
export class SpecService implements SpecHandler {
  constructor(private readonly native: NativeService, private readonly db: PrismaService) {}
  async execute(request: SpecRequest): Promise<SpecResult> {
    try {
      if (!request.endpoint.public) {
        if(!request.actor) throw new DomainException(3003,'Cần đăng nhập',401);
        this.authorize(request);
      }
      if (request.endpoint.action === 'unsupported')
        throw new DomainException(5010, request.endpoint.limitation!, 501);
      return {ok:true,data:await this.dispatch(request)};
    } catch (error) {
      if(error instanceof HttpException)return {ok:false,error};
      if(error instanceof Prisma.PrismaClientKnownRequestError) {
        const state=String(error.meta?.code??'');
        const status=error.code==='P2025'?404:error.code==='P2002'||error.code==='P2003'||state.startsWith('23')?409:state.startsWith('22')?400:500;
        return {ok:false,error:new DomainException(status===500?9000:status===404?4004:2003,status===409?'Dữ liệu trùng, thiếu trường hoặc bản ghi liên kết đang được sử dụng':status===404?'Không tìm thấy bản ghi':status===400?'Giá trị không đúng định dạng':'Không thể xử lý yêu cầu',status)};
      }
      if(error instanceof Prisma.PrismaClientUnknownRequestError) {
        // Keep CHECK-constraint diagnostics and database row contents private.
        const state=error.message.match(/code: "(\w{5})"/)?.[1]??'';
        if(state.startsWith('23')||state.startsWith('22'))return {ok:false,error:new DomainException(2003,'Dữ liệu không thỏa ràng buộc của database',state.startsWith('23')?409:400)};
      }
      return {ok:false,error:new DomainException(9000,'Không thể xử lý yêu cầu',500)};
    }
  }
  private async dispatch(r: SpecRequest): Promise<unknown> {
    const name=r.endpoint.resource, action=r.endpoint.action, actor=r.actor!;
    const accounts=new Accounts(this.native,this.db);
    const clinical=new Clinical(this.native,this.db);
    const media=new Media(this.native,this.db);
    if(action==='upload')return media.upload(actor,r.body,r.file);
    if(action==='files')return media.files(actor,r.params.user_id,r.query);
    if(action==='fileDelete')return media.remove(actor,r.params.id);
    if(action==='photoCreate')return media.photo(actor,r.body);
    if(action==='milestone')return media.milestone(actor,r.params.id,r.body);
    if(['signup','staff','userCreate'].includes(action))return accounts.register(r.body,action as 'signup'|'staff'|'userCreate');
    if(action==='login')return this.native.login(body(r.body),r.ip??'unknown');
    if(action==='logout')return this.native.logout(r.authorization??'');
    if(action==='password')return this.native.changePassword(actor,body(r.body));
    if(action==='profile')return accounts.profile(actor);
    if(action==='profileUpdate')return accounts.profileUpdate(actor,r.body);
    if(action==='userUpdate')return accounts.userUpdate(actor,r.params.id,r.body);
    if(action==='userDisable')return accounts.userUpdate(actor,r.params.id,{is_active:false});
    if(action==='assign')return accounts.assign(r.params.id,r.body);
    if(action==='grant') {
      const data=parse(z.object({role_id:idInput,permission_ids:z.array(idInput).min(1).max(200)}).strict(),r.body);
      return this.db.$transaction(async tx=>{
        const role=await tx.vaitro.findUnique({where:{ma_vai_tro:BigInt(data.role_id)}});
        const ids=[...new Set(data.permission_ids)];
        if(!role||await tx.quyenhan.count({where:{ma_quyen_han:{in:ids.map(BigInt)}}})!==ids.length)throw new DomainException(2003,'Vai trò hoặc quyền không tồn tại');
        await tx.vaitroquyenhan.createMany({data:ids.map(p=>({ma_vai_tro:BigInt(data.role_id),ma_quyen_han:BigInt(p),ma_nguoi_gan:BigInt(actor.personId)})),skipDuplicates:true});
        return {role_id:data.role_id,permission_ids:ids};
      });
    }
    if(action==='grants') {
      const roleId=id(r.params.role_id);
      if(!await this.db.vaitro.findUnique({where:{ma_vai_tro:BigInt(roleId)}}))throw new DomainException(4004,'Vai trò không tồn tại',404);
      const grants=await this.db.vaitroquyenhan.findMany({where:{ma_vai_tro:BigInt(roleId)},include:{quyenhan:true}});
      return {role_id:roleId,permissions:grants.map(g=>output('permissions',g.quyenhan))};
    }
    if(action==='revoke') {
      const roleId=id(r.params.role_id),permissionId=id(r.params.permission_id);
      const result=await this.db.vaitroquyenhan.deleteMany({where:{ma_vai_tro:BigInt(roleId),ma_quyen_han:BigInt(permissionId)}});
      if(!result.count)throw new DomainException(4004,'Quyền chưa được gán cho vai trò',404);
      return {deleted:true};
    }
    if(action==='recordCreate')return clinical.create(actor,r.body);
    if(action==='accept')return clinical.accept(actor,r.params.id);
    if(action==='complete')return clinical.complete(actor,r.params.id,r.body);
    if(action==='summary')return clinical.summary(actor,r.params.id);
    if(action==='eligibility')return clinical.eligibility(actor);
    if(action==='score')return clinical.score(actor,r.body);
    if(action==='prescribe')return clinical.prescribe(actor,r.body);
    if(action==='history') {
      const patientId=id(r.params.id);
      if(actor.role==='benh_nhan'&&patientId!==actor.personId)throw new DomainException(3106,'Chỉ xem lịch sử của mình',403);
      return this.list(actor,'records',r.query,{patient_id:patientId});
    }
    if(action==='scores') {
      const patientId=id(r.params.patient_id);
      if(actor.role==='benh_nhan'&&patientId!==actor.personId)throw new DomainException(3106,'Chỉ xem nhật ký của mình',403);
      return this.list(actor,'scores',r.query,{patient_id:patientId});
    }
    if(action==='patients') {
      this.requireRole(actor,['admin','bac_si','dieu_duong']);
      const people=await this.db.nguoi.findMany({where:{benhnhan:{isNot:null},OR:[{ho_ten:{contains:String(r.query.search??r.query.q??'').slice(0,200),mode:'insensitive'}},{so_dien_thoai:{contains:String(r.query.search??r.query.q??'').slice(0,200)}}]},include:{benhnhan:true},take:Math.min(100,Math.max(1,Number(r.query.limit)||25)),skip:(Math.max(1,Number(r.query.page)||1)-1)*Math.min(100,Math.max(1,Number(r.query.limit)||25)),orderBy:{ma_nguoi:'desc'}});
      return people.map(row=>({...output('people',row),benhnhan:undefined,patient:row.benhnhan?output('patients',row.benhnhan):null}));
    }
    if(action==='patientCreate') {
      this.requireRole(actor,['admin','bac_si','dieu_duong']);
      const data=body(r.body);
      // Existing reception flow creates person + patient without inventing account credentials.
      const person=input('people',data.person??Object.fromEntries(Object.entries(data).filter(([k])=>k!=='patient')));
      const patient=input('patients',data.patient??{});
      return output('people',await this.native.createPerson(actor,{person,patient}));
    }
    if(action==='myEpisodes')return this.list(actor,'episodes',r.query,{patient_id:actor.personId});
    if(action==='locations') {
      await this.native.detail(actor,'dottonthuongda',key('episodes',r.params.episode_id));
      return this.list(actor,'locations',r.query,{episode_id:id(r.params.episode_id)});
    }
    if(action==='photos') {
      await this.native.detail(actor,'vitritonthuong',key('locations',r.params.location_id));
      return this.list(actor,'photos',r.query,{location_id:id(r.params.location_id)});
    }
    if(action==='labs') {
      const recordId=id(r.params.record_id);
      await this.native.detail(actor,'hosobenhan',key('records',recordId));
      return this.db.ketquacanlamsang.findMany({where:{phienkham:{ma_ho_so:BigInt(recordId)}},include:{ketquacanlamsangcap_ketquacanlamsangcap_ma_ket_qua_can_lam_sang_loai_ket_qua_can_lam_sangToketquacanlamsang:true,ketquacanlamsangman_ketquacanlamsangman_ma_ket_qua_can_lam_sang_loai_ket_qua_can_lam_sangToketquacanlamsang:true},orderBy:{ma_ket_qua_can_lam_sang:'desc'}});
    }
    if(name && ['list','detail','create','update','delete'].includes(action)) {
      const resource=resources[name];
      if(action==='list')return this.list(actor,name,r.query);
      if(action==='detail')return output(name,await this.native.detail(actor,resource.table,key(name,r.params.id)));
      if(action==='create')return output(name,await this.native.create(actor,resource.table,input(name,r.body)));
      if(action==='update')return output(name,await this.native.update(actor,resource.table,key(name,r.params.id),input(name,r.body,true)));
      return this.native.removeMapped(actor,resource.table,key(name,r.params.id));
    }
    throw new DomainException(5010,'Chưa ánh xạ thao tác',501);
  }
  private async list(actor: Actor, name: string, raw: Record<string,unknown>, filters: Record<string,unknown>={}) {
    const rows=await this.native.list(actor,resources[name].table,query(name,raw,filters));
    return {...rows,data:rows.data.map(row=>output(name,row))};
  }
  private authorize(r: SpecRequest) {
    const actor=r.actor!;
    if(!['admin','bac_si','dieu_duong','benh_nhan'].includes(actor.role))throw new DomainException(3101,'Không có quyền truy cập',403);
    const adminResources=['users','roles','permissions'];
    const adminActions=['staff','userCreate','userUpdate','userDisable','assign','grant','grants','revoke'];
    const adminWrite=['branches','departments','rooms'];
    if(adminResources.includes(r.endpoint.resource??'') || adminActions.includes(r.endpoint.action) ||
      (adminWrite.includes(r.endpoint.resource??'')&&!['list','detail'].includes(r.endpoint.action))) this.requireRole(actor,['admin']);
  }
  private requireRole(actor: Actor, roles: string[]) {
    if(!roles.includes(actor.role))throw new DomainException(3101,'Không có quyền thực hiện thao tác',403);
  }
}
