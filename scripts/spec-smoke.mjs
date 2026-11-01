// Full HTTP tests use only a disposable database. The source database is read by
// pg_dump --schema-only; no source rows, passwords or connection URLs are logged.
import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
import {hash} from 'bcryptjs';
import {execFileSync,spawn} from 'node:child_process';
import {existsSync,mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {endpoints}=require('../apps/api/dist/spec/catalog.js');
const folder=mkdtempSync(join(tmpdir(),'mayday-spec-'));
const source=new URL(process.env.DATABASE_URL);
const createdName=`mayday_test_spec_${Date.now()}`;
const pgEnv={...process.env,PGHOST:source.hostname,PGPORT:source.port||'5432',PGUSER:decodeURIComponent(source.username),PGPASSWORD:decodeURIComponent(source.password),PGDATABASE:decodeURIComponent(source.pathname.slice(1))};
const pgOptions={env:pgEnv,windowsHide:true,stdio:'pipe'};
let db,server,web,created=false;
const results=[];
const exercised=new Set();
function mark(method,path){
  path=path.split('?')[0];
  const match=endpoints.find(e=>e.method===method&&e.path.split('/').length===path.slice(1).split('/').length&&e.path.split('/').every((part,i)=>part.startsWith(':')||part===path.slice(1).split('/')[i]));
  if(match)exercised.add(match.source);
}
let base,logs='';
async function check(name,fn){await fn();results.push({name,passed:true});console.log(`PASS ${name}`);}
async function request(path,{method='GET',token,body,status=200,raw=false}={}) {
  const multipart=body instanceof FormData;
  const response=await fetch(base+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`} :{}),...(body&&!multipart?{'Content-Type':'application/json'}:{})},body:body?(multipart?body:JSON.stringify(body)):undefined});
  const result=raw?await response.arrayBuffer():await response.json();
  assert.equal(response.status,status,`${method} ${path}: ${raw?'binary':JSON.stringify(result)}`);
  if(response.ok)mark(method,path);
  return result;
}
try{
  execFileSync('pg_dump',['--schema-only','--schema=public','--no-owner','--no-privileges','--file',join(folder,'schema.sql')],pgOptions);
  execFileSync('createdb',[createdName],pgOptions);created=true;
  assert.match(createdName,/^mayday_test_spec_\d+$/);
  execFileSync('psql',['--dbname',createdName,'--set','ON_ERROR_STOP=1','--command','DROP SCHEMA public'],pgOptions);
  execFileSync('psql',['--dbname',createdName,'--set','ON_ERROR_STOP=1','--file',join(folder,'schema.sql')],pgOptions);
  const testUrl=new URL(source);testUrl.pathname='/'+createdName;
  db=new PrismaClient({datasources:{db:{url:testUrl.toString()}}});
  for(const role of ['admin','bac_si','dieu_duong','benh_nhan'])await db.vaitro.create({data:{ten_vai_tro:role,ten_hien_thi:role}});
  const roles=await db.vaitro.findMany();
  const branch=await db.chinhanh.create({data:{ten_chi_nhanh:'Fixture',dia_chi:'Test'}});
  const password='MaydayTestPassword2026!';
  async function employee(role,phone){
    const person=await db.nguoi.create({data:{ho_ten:'Fixture '+role,so_dien_thoai:phone}});
    await db.nhanvien.create({data:{ma_nhan_vien:person.ma_nguoi,ma_chi_nhanh:branch.ma_chi_nhanh}});
    const user=await db.taikhoan.create({data:{ma_nguoi:person.ma_nguoi,ma_vai_tro:roles.find(r=>r.ten_vai_tro===role).ma_vai_tro,ten_dang_nhap:phone,mat_khau_ma_hoa:await hash(password,10)}});
    return {person,user};
  }
  const admin=await employee('admin','0999999001'),doctor=await employee('bac_si','0999999002'),otherDoctor=await employee('bac_si','0999999003');
  const port=await new Promise((done,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>done(port));});});
  base=`http://127.0.0.1:${port}/api/v1`;
  server=spawn(process.execPath,['apps/api/dist/main.js'],{env:{...process.env,DATABASE_URL:testUrl.toString(),PORT:String(port),SESSION_FILE:join(folder,'sessions.json'),UPLOAD_DIR:join(folder,'uploads')},windowsHide:true,stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
  for(let n=0;n<100;n++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  await check('all 92 operations are registered in Swagger and protected before dispatch',async()=>{
    const spec=await (await fetch(`http://127.0.0.1:${port}/api/docs-json`)).json();
    for(const e of endpoints){
      const swaggerPath='/api/v1/'+e.path.replace(/:([a-z_]+)/g,'{$1}');
      assert.ok(spec.paths[swaggerPath]?.[e.method.toLowerCase()],`${e.source} absent from Swagger`);
      if(!e.public)await request('/'+e.path.replace(/:[a-z_]+/g,'1'),{method:e.method,status:401,body:['POST','PUT','PATCH'].includes(e.method)?{}:undefined});
    }
  });
  const login=async phone=>(await request('/auth/login',{method:'POST',body:{phone,password}})).data.token;
  const adminToken=await login('0999999001'),doctorToken=await login('0999999002'),otherDoctorToken=await login('0999999003');
  let patient,otherPatient,patientToken,otherPatientToken,record,visit,file,episode,location,photo;
  await check('signup is atomic and forces patient role; duplicate registration is rejected',async()=>{
    await request('/auth/signup',{method:'POST',body:{full_name:'Bad',phone:'0999999010',password,role_id:String(roles[0].ma_vai_tro)},status:400});
    patient=(await request('/auth/signup',{method:'POST',body:{full_name:'Fixture Patient',phone:'0999999010',password,gender:'female'},status:201})).data;
    otherPatient=(await request('/auth/signup',{method:'POST',body:{full_name:'Fixture Other',phone:'0999999011',password},status:201})).data;
    assert.equal(patient.role_id,String(roles.find(r=>r.ten_vai_tro==='benh_nhan').ma_vai_tro));
    assert.equal(await db.taikhoan.count({where:{ma_nguoi:BigInt(patient.person_id)}}),1);
    await request('/auth/signup',{method:'POST',body:{full_name:'Again',phone:'0999999010',password},status:409});
    patientToken=await login('0999999010');otherPatientToken=await login('0999999011');
  });
  await check('profile changes persist and cannot change identity or privileges',async()=>{
    await request('/profile',{method:'PUT',token:patientToken,body:{full_name:'Must not persist',occupation:'Tester'},status:400});
    await request('/profile',{method:'PUT',token:patientToken,body:{full_name:'Updated Patient',occupation:'Khac'}});
    const profile=(await request('/profile',{token:patientToken})).data;
    assert.equal(profile.full_name,'Updated Patient');assert.equal(profile.patient.occupation,'Khac');
    await request('/profile',{method:'PUT',token:patientToken,body:{role_id:'1'},status:400});
    assert.equal(JSON.stringify(profile).includes('mat_khau'),false);
  });
  await check('topology CRUD persists aliases and enforces admin and foreign keys',async()=>{
    await request('/branches',{method:'POST',token:patientToken,body:{name:'No',address:'No'},status:403});
    const b=(await request('/branches',{method:'POST',token:adminToken,body:{name:'Second',address:'Test'},status:201})).data;
    const d=(await request('/departments',{method:'POST',token:adminToken,body:{name:'Clinic',type:'KHOA',branch_id:b.id},status:201})).data;
    const room=(await request('/rooms',{method:'POST',token:adminToken,body:{name:'Room',department_id:d.id},status:201})).data;
    await request('/branches/'+b.id,{method:'PUT',token:adminToken,body:{name:'Updated'}});
    assert.equal((await request('/branches/'+b.id,{token:patientToken})).data.name,'Updated');
    await request('/branches/'+b.id,{method:'DELETE',token:adminToken,status:409});
    await request('/rooms/'+room.id,{method:'DELETE',token:adminToken});
    await request('/departments/'+d.id,{method:'DELETE',token:adminToken});
    await request('/branches/'+b.id,{method:'DELETE',token:adminToken});
  });
  await check('permission grants are idempotent and revoke correctly',async()=>{
    const p=(await request('/permissions',{method:'POST',token:adminToken,body:{name:'test_read'},status:201})).data;
    const roleId=String(roles.find(r=>r.ten_vai_tro==='bac_si').ma_vai_tro);
    for(let i=0;i<2;i++)await request('/role_permissions',{method:'POST',token:adminToken,body:{role_id:roleId,permission_ids:[p.id]},status:201});
    assert.equal((await request('/role_permissions/'+roleId,{token:adminToken})).data.permissions.length,1);
    await request(`/role_permissions/${roleId}/${p.id}`,{method:'DELETE',token:adminToken});
    await request('/permissions/'+p.id,{method:'DELETE',token:adminToken});
  });
  await check('remaining administration routes persist account, role and assignment changes',async()=>{
    const role=(await request('/roles',{method:'POST',token:adminToken,body:{name:'test_custom',display_name:'Test custom'},status:201})).data;
    assert.ok((await request('/roles',{token:adminToken})).data.some(r=>r.id===role.id));
    const p=(await request('/permissions',{method:'POST',token:adminToken,body:{name:'test_edit'},status:201})).data;
    await request('/permissions/'+p.id,{method:'PUT',token:adminToken,body:{description:'Updated'}});
    await request('/permissions',{token:adminToken});
    const staff=(await request('/auth/admin/create-staff',{method:'POST',token:adminToken,body:{full_name:'Test nurse',phone:'0999999020',password,role_id:String(roles.find(r=>r.ten_vai_tro==='dieu_duong').ma_vai_tro),branch_id:String(branch.ma_chi_nhanh)},status:201})).data;
    const nurseToken=await login('0999999020');
    await request('/admin/users',{token:nurseToken,status:403});
    await request('/admin/users/'+staff.user_id+'/assign',{method:'PUT',token:adminToken,body:{branch_id:String(branch.ma_chi_nhanh)}});
    await request('/admin/users/'+staff.user_id+'/assign',{method:'PUT',token:adminToken,body:{branch_id:String(branch.ma_chi_nhanh),department_id:'1'},status:400});
    await request('/admin/users/'+staff.user_id,{method:'PUT',token:adminToken,body:{full_name:'Updated nurse'}});
    const users=(await request('/admin/users',{token:adminToken})).data;
    assert.ok(users.some(u=>u.id===staff.user_id));
    const account=(await request('/admin/users/'+staff.user_id,{token:adminToken})).data;
    assert.equal(account.id,staff.user_id);assert.equal('mat_khau_ma_hoa' in account,false);
    await request('/admin/users/'+staff.user_id,{method:'DELETE',token:adminToken});
    await request('/profile',{token:nurseToken,status:401});
    assert.ok(await db.nguoi.findUnique({where:{ma_nguoi:BigInt(staff.person_id)}}));
    await request('/admin/users',{method:'POST',token:adminToken,body:{full_name:'Admin-created patient',phone:'0999999021',password},status:201});
    const received=(await request('/doctor/patients',{method:'POST',token:doctorToken,body:{person:{full_name:'Received patient',phone:'0999999022'},patient:{occupation:'Khac'}},status:201})).data;
    assert.ok(received.id);
    assert.ok((await request('/doctor/patients/search?search=Received',{token:doctorToken})).data.length>0);
    const topology=(await request('/branches',{token:adminToken})).data;
    assert.ok(topology.length>0);
    const d=(await request('/departments',{method:'POST',token:adminToken,body:{name:'Coverage dept',type:'KHOA',branch_id:String(branch.ma_chi_nhanh)},status:201})).data;
    const room=(await request('/rooms',{method:'POST',token:adminToken,body:{name:'Coverage room',department_id:d.id},status:201})).data;
    await request('/departments',{token:adminToken});await request('/departments/'+d.id,{token:adminToken});
    await request('/departments/'+d.id,{method:'PUT',token:adminToken,body:{name:'Updated dept'}});
    await request('/rooms',{token:adminToken});await request('/rooms/'+room.id,{token:adminToken});
    await request('/rooms/'+room.id,{method:'PUT',token:adminToken,body:{name:'Updated room'}});
  });
  await check('record creation is scoped and creates chronic subtype atomically',async()=>{
    await request('/medical_records',{method:'POST',token:patientToken,body:{patient_id:otherPatient.person_id,record_type:'MAN'},status:403});
    record=(await request('/medical_records',{method:'POST',token:patientToken,body:{record_type:'MAN'},status:201})).data;
    assert.equal(record.patient_id,patient.person_id);
    assert.ok(await db.benhanmaydayman.findUnique({where:{ma_ho_so:BigInt(record.id)}}));
    await request('/medical_records/'+record.id,{token:otherPatientToken,status:404});
    await request('/medical_records/patients/'+patient.person_id+'/history',{token:otherPatientToken,status:403});
    const listed=(await request('/medical_records/all',{token:patientToken})).data;
    assert.equal(listed.length,1);
    await request('/medical_records/'+record.id,{token:patientToken});
    await request('/medical_records/patients/'+patient.person_id+'/history',{token:patientToken});
    const acute=(await request('/medical_records',{method:'POST',token:doctorToken,body:{patient_id:patient.person_id,record_type:'CAP'},status:201})).data;
    assert.ok(await db.benhanmaydaycap.findUnique({where:{ma_ho_so:BigInt(acute.id)}}));
  });
  await check('concurrent acceptance has one winner and persists the assigned visit',async()=>{
    const accept=token=>fetch(base+'/medical_records/'+record.id+'/accept',{method:'POST',headers:{Authorization:`Bearer ${token}`}});
    const responses=await Promise.all([accept(doctorToken),accept(otherDoctorToken)]);
    assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
    mark('POST','/medical_records/'+record.id+'/accept');
    const winner=responses.findIndex(r=>r.status===201);
    if(winner===1){[doctorToken,otherDoctorToken]=[otherDoctorToken,doctorToken];}
    visit=(await (await request('/medical_records/'+record.id+'/summary',{token:doctorToken})).data).latest_visit;
    assert.equal(await db.phienkham.count({where:{ma_ho_so:BigInt(record.id)}}),1);
    assert.ok(await db.phienkhamman.findUnique({where:{ma_phien_kham:BigInt(visit.id)}}));
  });
  await check('daily UAS is generated by PostgreSQL and duplicate submissions are serialized',async()=>{
    assert.equal((await request('/uas7-scores/eligibility',{token:patientToken})).data.eligible,true);
    const score=()=>fetch(base+'/uas7-scores',{method:'POST',headers:{Authorization:`Bearer ${patientToken}`,'Content-Type':'application/json'},body:JSON.stringify({medical_record_id:record.id,hss_score:2,iss_score:3})});
    const responses=await Promise.all([score(),score()]);
    assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
    mark('POST','/uas7-scores');
    const success=await responses.find(r=>r.status===201).json();assert.equal(success.data.uas_score,5);
    await request('/uas7-scores/patient/'+patient.person_id,{token:otherPatientToken,status:403});
    await request('/uas7-scores/patient/'+patient.person_id,{token:patientToken});
    await request('/uas7-scores',{method:'POST',token:patientToken,body:{hss_score:4,iss_score:0},status:400});
  });
  await check('prescribing is restricted to the assigned doctor and rolls back invalid medicines',async()=>{
    const prescription={medical_record_id:record.id,medicines:[{name:'Fixture medicine',dosage:'Test only',duration:'Test only'}]};
    await request('/prescriptions',{method:'POST',token:otherDoctorToken,body:prescription,status:403});
    await request('/prescriptions',{method:'POST',token:doctorToken,body:{...prescription,medicines:[{medicine_id:'missing',dosage:'X',duration:'X'}]},status:409});
    assert.equal(await db.donthuoc.count(),0);
    await request('/prescriptions',{method:'POST',token:doctorToken,body:prescription,status:201});
    assert.equal(await db.chitietdonthuoc.count(),1);
    await request('/lab-results/'+record.id,{token:patientToken});
  });
  await check('private uploads persist, reject cross-patient links and protect downloads',async()=>{
    const form=new FormData();form.append('medical_record_id',record.id);form.append('image',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'fixture.png');
    file=(await request('/image-attachments/upload',{method:'POST',token:patientToken,body:form,status:201})).data;
    assert.equal('duong_dan_luu_tru' in file,false);
    await request('/image-attachments/'+file.id+'/content',{token:patientToken,raw:true});
    await request('/image-attachments/'+file.id+'/content',{token:otherPatientToken,status:404});
    await request('/image-attachments/user/'+patient.user_id,{token:otherPatientToken,status:403});
    await request('/image-attachments/user/'+patient.user_id,{token:patientToken});
    episode=(await request('/lesion-episodes',{method:'POST',token:patientToken,body:{medical_record_id:record.id,name:'Fixture'},status:201})).data;
    location=(await request('/lesion-locations',{method:'POST',token:patientToken,body:{episode_id:episode.id,body_location:'Arm'},status:201})).data;
    await request('/lesion-episodes/my',{token:patientToken});
    await request('/lesion-episodes/'+episode.id,{token:patientToken});
    await request('/lesion-episodes/'+episode.id,{method:'PATCH',token:patientToken,body:{name:'Updated episode'}});
    await request('/lesion-locations/episode/'+episode.id,{token:patientToken});
    await request('/lesion-locations/'+location.id,{method:'PATCH',token:patientToken,body:{body_location:'Updated arm'}});
    photo=(await request('/lesion-photos',{method:'POST',token:patientToken,body:{attachment_id:file.id,location_id:location.id,taken_at:new Date().toISOString(),milestone:'start'},status:201})).data;
    await request('/lesion-photos',{method:'POST',token:otherPatientToken,body:{attachment_id:file.id,location_id:location.id,taken_at:new Date().toISOString(),milestone:'start'},status:404});
    await request('/lesion-photos/location/'+location.id,{token:patientToken});
    await request('/lesion-photos/'+photo.id+'/milestone',{method:'PATCH',token:patientToken,body:{milestone:'normal'}});
    await request('/lesion-photos/'+photo.id+'/milestone',{method:'PATCH',token:otherPatientToken,body:{milestone:'peak'},status:404});
    await request('/image-attachments/'+file.id,{method:'DELETE',token:patientToken,status:409});
    await request('/lesion-photos/'+photo.id,{method:'DELETE',token:patientToken});
    await request('/lesion-locations/'+location.id,{method:'DELETE',token:patientToken});
    await request('/lesion-episodes/'+episode.id,{method:'DELETE',token:patientToken});
    await request('/image-attachments/'+file.id,{method:'DELETE',token:patientToken});
  });
  await check('completion is assigned-doctor-only and cannot repeat or prescribe afterwards',async()=>{
    await request('/medical_records/'+record.id,{method:'PUT',token:otherDoctorToken,body:{instructions:'Test'},status:403});
    await request('/medical_records/'+record.id,{method:'PUT',token:doctorToken,body:{instructions:'Test instructions'}});
    assert.equal((await db.phienkham.findUnique({where:{ma_phien_kham:BigInt(visit.id)}})).dan_do,'Test instructions');
    await request('/medical_records/'+record.id,{method:'PUT',token:doctorToken,body:{instructions:'Again'},status:409});
    await request('/prescriptions',{method:'POST',token:doctorToken,body:{medical_record_id:record.id,medicines:[{name:'Test',dosage:'X',duration:'X'}]},status:409});
  });
  await check('every unsupported schema operation returns 501 without fake success',async()=>{
    for(const e of endpoints.filter(e=>e.action==='unsupported'))await request('/'+e.path.replace(/:[a-z_]+/g,'1'),{method:e.method,token:adminToken,body:['POST','PUT','PATCH'].includes(e.method)?{}:undefined,status:501});
  });
  await check('password changes and logout revoke sessions',async()=>{
    await request('/auth/change-password',{method:'PUT',token:patientToken,body:{old_password:password,new_password:'ChangedPassword2026!'}});
    await request('/profile',{token:patientToken,status:401});
    await request('/auth/logout',{method:'POST',token:otherPatientToken});
    await request('/profile',{token:otherPatientToken,status:401});
  });
  await check('every mapped operation has at least one successful real HTTP request',async()=>{
    const missing=endpoints.filter(e=>e.action!=='unsupported'&&!exercised.has(e.source));
    assert.deepEqual(missing.map(e=>e.source),[]);
  });
  if(process.env.SPEC_WEB_PREVIEW==='1'){
    await request('/medical_records',{method:'POST',token:adminToken,body:{patient_id:patient.person_id,record_type:'MAN',initial_diagnosis:'Hồ sơ kiểm thử giao diện'},status:201});
    web=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5175','--strictPort'],{cwd:resolve('apps/web'),env:{...process.env,API_PROXY_TARGET:`http://127.0.0.1:${port}`},windowsHide:true,stdio:['ignore','pipe','pipe']});
    web.stdout.on('data',b=>process.stdout.write(b));web.stderr.on('data',b=>process.stderr.write(b));
    mkdirSync('.data',{recursive:true});
    writeFileSync('.data/web-preview.json',JSON.stringify({url:'http://127.0.0.1:5175',stopFile:join(folder,'stop')}));
    console.log('UI PREVIEW: http://127.0.0.1:5175 — disposable fixture database only.');
    while(!existsSync(join(folder,'stop'))&&web.exitCode===null)await new Promise(r=>setTimeout(r,500));
  }
}catch(error){console.error(error.message);console.error(logs.slice(-5000));results.push({name:error.message,passed:false});process.exitCode=1;}
finally{
  if(web){web.kill();await new Promise(done=>{if(web.exitCode!==null)done();else web.once('exit',done);});}
  if(server){server.kill();await new Promise(done=>{if(server.exitCode!==null)done();else server.once('exit',done);});}
  if(db)await db.$disconnect();
  if(created&&/^mayday_test_spec_\d+$/.test(createdName))execFileSync('dropdb',['--force',createdName],pgOptions);
  writeFileSync('docs/spec-api-test-results.json',JSON.stringify({timestamp:new Date().toISOString(),database:'disposable schema-only copy; dropped after test',operations:endpoints.length,mapped:endpoints.filter(e=>e.action!=='unsupported').length,unsupported:endpoints.filter(e=>e.action==='unsupported').length,successfulHttpOperations:exercised.size,results},null,2)+'\n');
}
