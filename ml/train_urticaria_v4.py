"""Separate two-class Colab training run. Never modifies the original archive."""
def main():
    import sys, json, hashlib, zipfile, time, shutil, csv
    from pathlib import Path, PurePosixPath
    from datetime import datetime
    from collections import Counter, defaultdict
    import torch
    from ultralytics import YOLO
    assert torch.cuda.is_available(), 'GPU required'
    from google.colab import drive
    drive.mount('/content/drive')
    source=Path('/content/Urticaria.v4i.yolov8.zip')
    sha=hashlib.sha256(source.read_bytes()).hexdigest()
    assert sha=='d69ee34d34886a88cfc885c30d31ba497d84844cb25f235f259b61211e440def'
    stamp=datetime.now().strftime('%Y%m%d_%H%M%S')
    data=Path('/content')/('mayday_v4_'+stamp)
    root=Path('/content/drive/MyDrive/MayDayAI/v4_two_class')
    root.mkdir(parents=True,exist_ok=True)
    shutil.copy2(source,root/source.name)
    data.mkdir()
    hashes=defaultdict(list); counts=Counter(); labels=Counter(); groups=defaultdict(set)
    with zipfile.ZipFile(source) as z:
        source_splits=defaultdict(set)
        for n in z.namelist():
            q=PurePosixPath(n)
            if len(q.parts)==3 and q.parts[1]=='images':
                source_splits[q.name.split('.rf.')[0]].add(q.parts[0])
        priority={'test':0,'valid':1,'train':2}
        owner={k:min(v,key=lambda split:priority[split]) for k,v in source_splits.items()}
        excluded=[]
        seen=set()
        for info in z.infolist():
            p=PurePosixPath(info.filename)
            if len(p.parts)!=3 or p.parts[0] not in ('train','valid','test') or p.parts[1] not in ('images','labels'): continue
            group=p.name.split('.rf.')[0]
            if owner.get(group,p.parts[0]) != p.parts[0]:
                excluded.append(info.filename)
                continue
            assert info.filename not in seen, 'Duplicate member'
            seen.add(info.filename)
            if p.parts[1]=='images':
                assert p.suffix.lower() in ('.jpg','.jpeg','.png')
                content=z.read(info)
                hashes[hashlib.sha256(content).hexdigest()].append(info.filename)
                counts[p.parts[0]]+=1
                groups[p.name.split('.rf.')[0]].add(p.parts[0])
                label=str(p).replace('/images/','/labels/')
                label=str(PurePosixPath(label).with_suffix('.txt'))
                assert label in z.namelist(), 'Missing label'
            else:
                content=z.read(info)
                for line in content.decode('utf-8-sig').splitlines():
                    if not line.strip(): continue
                    vals=list(map(float,line.split()))
                    assert len(vals)==5
                    c,x,y,w,h=vals
                    assert c in (0,1) and w>0 and h>0 and all(0<=v<=1 for v in vals[1:])
                    assert min(x-w/2,y-h/2)>=-1e-5 and max(x+w/2,y+h/2)<=1.00001
                    labels[int(c)]+=1
            target=data/str(p);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(content)
    assert not any(len({n.split('/')[0] for n in v})>1 for v in hashes.values()), 'Cross split exact duplicate'
    assert not any(len(v)>1 for v in groups.values()), 'Source filename crosses splits'
    (data/'data.yaml').write_text(f'path: {data.as_posix()}\ntrain: train/images\nval: valid/images\ntest: test/images\nnames:\n  0: normal skin\n  1: urticaria\n')
    audit={'sha256':sha,'images':dict(counts),'annotations':dict(labels),'exact_duplicate_groups':[v for v in hashes.values() if len(v)>1], 'excluded_cross_split_members':excluded,'source_filename_split_disjoint':True,'patient_split_verified':False,'augmentation':'Source export includes flip/crop/blur augmented training images; 230 is not independent patient count.'}
    print('AUDIT',json.dumps(audit),flush=True)
    run='yolov8n_v4_'+stamp
    model=YOLO('yolov8n.pt')
    start=time.perf_counter()
    model.train(data=str(data/'data.yaml'),epochs=100,patience=20,imgsz=640,batch=8,device=0,workers=2,amp=True,seed=42,deterministic=True,project=str(root/'runs'),name=run,exist_ok=False,save=True,save_period=10,plots=True,hsv_h=0.005,hsv_s=0.1,hsv_v=0.2,mosaic=0.0,fliplr=0.0,flipud=0.0)
    elapsed=(time.perf_counter()-start)/60
    out=Path(model.trainer.save_dir)
    best=YOLO(str(out/'weights/best.pt'))
    metrics=best.val(data=str(data/'data.yaml'),split='test',imgsz=640,batch=8,device=0,plots=True,project=str(out),name='test')
    best.predict(source=str(data/'test/images'),imgsz=640,conf=0.25,device=0,save=True,save_txt=True,save_conf=True,project=str(out),name='test_predictions')
    report={'run':str(out),'dataset_sha256':sha,'training_minutes':elapsed,'gpu':torch.cuda.get_device_name(0),'test_metrics':{k:float(v) for k,v in metrics.results_dict.items()},'per_class':[{'name':metrics.names[int(c)],'precision':float(metrics.box.p[i]),'recall':float(metrics.box.r[i]),'map50':float(metrics.box.ap50[i]),'map50_95':float(metrics.box.ap[i])} for i,c in enumerate(metrics.box.ap_class_index)],'weights_sha256':hashlib.sha256((out/'weights/best.pt').read_bytes()).hexdigest(),'limitations':['10 test images only','Patient split unknown','Two-class regional detection, not clinical diagnosis','Not comparable directly to old three-class mAP']}
    (out/'training-report.json').write_text(json.dumps(report,indent=2))
    (out/'audit.json').write_text(json.dumps(audit,indent=2))
    shutil.copy2(data/'data.yaml',out/'data.yaml')
    shutil.copy2(__file__,out/'train_urticaria_v4.py')
    env=__import__('subprocess').run([sys.executable,'-m','pip','freeze'],capture_output=True,text=True,check=True)
    (out/'environment.txt').write_text(env.stdout)
    bundle=Path('/content/MayDay_Urticaria_v4_two_class.zip')
    with zipfile.ZipFile(bundle,'w',zipfile.ZIP_DEFLATED) as z:
        for p in out.rglob('*'):
            if p.is_file() and not (p.parent.name=='weights' and p.name!='best.pt'):z.write(p,p.relative_to(out))
    shutil.copy2(bundle,root/bundle.name)
    print('FINAL_REPORT',json.dumps(report,indent=2),flush=True)
    print('BUNDLE',bundle,bundle.stat().st_size,flush=True)

if __name__=='__main__':main()
