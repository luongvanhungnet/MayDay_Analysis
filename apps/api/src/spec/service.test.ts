import { expect, it, vi } from 'vitest';
import { SpecService } from './service';
import { endpoints } from './catalog';
import { NativeService } from '../native/native.service';
import { PrismaService } from '../common/prisma.service';

it('returns an explicit schema limitation without attempting to persist a dynamic form', async () => {
  const native = { create: vi.fn() };
  const service = new SpecService(native as unknown as NativeService, {} as PrismaService);
  const result = await service.execute({ endpoint: endpoints.find(e => e.source === 'set_template (tmpl01)')!, actor: {accountId:'1',personId:'1',role:'admin'}, params:{}, query:{}, body:{name:'Test'} });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.getStatus()).toBe(501);
  expect(native.create).not.toHaveBeenCalled();
});

it('denies a patient creating a branch before touching the database', async () => {
  const native = { create: vi.fn() };
  const service = new SpecService(native as unknown as NativeService, {} as PrismaService);
  const result = await service.execute({endpoint:endpoints.find(e=>e.source==='set_branch (branch01)')!,actor:{accountId:'2',personId:'2',role:'benh_nhan'},params:{},query:{},body:{name:'Bad',address:'A'}});
  expect(result.ok).toBe(false);
  if(!result.ok) expect(result.error.getStatus()).toBe(403);
  expect(native.create).not.toHaveBeenCalled();
});

it('creates a branch using the existing native policy and returns the specification field names', async () => {
  const native = {create:vi.fn().mockResolvedValue({ma_chi_nhanh:5n,ten_chi_nhanh:'A',dia_chi:'B'})};
  const service=new SpecService(native as unknown as NativeService,{} as PrismaService);
  const result=await service.execute({endpoint:endpoints.find(e=>e.source==='set_branch (branch01)')!,actor:{accountId:'1',personId:'1',role:'admin'},params:{},query:{},body:{name:'A',address:'B'}});
  expect(result).toEqual({ok:true,data:{id:'5',name:'A',address:'B'}});
  expect(native.create).toHaveBeenCalledWith(expect.objectContaining({role:'admin'}),'chinhanh',{ten_chi_nhanh:'A',dia_chi:'B'});
});

it('rejects privilege injection during public signup before any database write', async () => {
  const transaction=vi.fn();
  const service=new SpecService({} as NativeService,{$transaction:transaction} as unknown as PrismaService);
  const result=await service.execute({endpoint:endpoints[0],params:{},query:{},body:{full_name:'Test',phone:'0999999999',password:'SafePassword2026!',role_id:'1'}});
  expect(result.ok).toBe(false);
  if(!result.ok)expect(result.error.getStatus()).toBe(400);
  expect(transaction).not.toHaveBeenCalled();
});

it('prevents patient record creation for another patient', async () => {
  const create=vi.fn();
  const service=new SpecService({create} as unknown as NativeService,{} as PrismaService);
  const result=await service.execute({endpoint:endpoints.find(e=>e.source==='set_medicalrecords_create(medrec03)')!,actor:{accountId:'2',personId:'2',role:'benh_nhan'},params:{},query:{},body:{patient_id:'3',record_type:'MAN'}});
  expect(result.ok).toBe(false);
  if(!result.ok)expect(result.error.getStatus()).toBe(403);
  expect(create).not.toHaveBeenCalled();
});

it('validates all permission IDs before opening an atomic grant transaction', async () => {
  const transaction=vi.fn();
  const service=new SpecService({} as NativeService,{$transaction:transaction} as unknown as PrismaService);
  const result=await service.execute({endpoint:endpoints.find(e=>e.source==='set_role_permissions(roleperm01)')!,actor:{accountId:'1',personId:'1',role:'admin'},params:{},query:{},body:{role_id:'2',permission_ids:['1','x']}});
  expect(result.ok).toBe(false);
  if(!result.ok)expect(result.error.getStatus()).toBe(400);
  expect(transaction).not.toHaveBeenCalled();
});

it('rejects a forged image MIME type before accessing a record or writing a file', async () => {
  const detail=vi.fn();
  const service=new SpecService({detail} as unknown as NativeService,{} as PrismaService);
  const result=await service.execute({endpoint:endpoints.find(e=>e.action==='upload')!,actor:{accountId:'2',personId:'2',role:'benh_nhan'},params:{},query:{},body:{medical_record_id:'1'},file:{originalname:'x.jpg',mimetype:'image/jpeg',buffer:Buffer.from('<script>bad</script>')}});
  expect(result.ok).toBe(false);
  if(!result.ok)expect(result.error.getStatus()).toBe(400);
  expect(detail).not.toHaveBeenCalled();
});

it('accepts the normal milestone specified by the document and rejects invented values', async () => {
  const update=vi.fn().mockResolvedValue({ma_anh:1n,moc_tien_trien:'normal'});
  const service=new SpecService({update} as unknown as NativeService,{} as PrismaService);
  const request={endpoint:endpoints.find(e=>e.action==='milestone')!,actor:{accountId:'2',personId:'2',role:'benh_nhan'},params:{id:'1'},query:{},body:{milestone:'normal'}};
  expect(await service.execute(request)).toEqual({ok:true,data:{id:'1',milestone:'normal'}});
  const invalid=await service.execute({...request,body:{milestone:'recovery'}});
  expect(invalid.ok).toBe(false);
  expect(update).toHaveBeenCalledTimes(1);
});
