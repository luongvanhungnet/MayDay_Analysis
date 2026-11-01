"""Freeze 63 shortlisted images: supervised proxy split + unlabeled qualitative set."""
import json, random, zipfile, hashlib, shutil
from pathlib import Path, PurePosixPath
from prepare_urticaria import detection_row

root=Path('.data/ml/quality63-experiment')
root.mkdir(exist_ok=False)
audit=Path('.data/ml/quality-audit-100-target')
records=[r for r in json.loads((audit/'quality-audit.json').read_text(encoding='utf-8'))['records'] if r['visual_decision']=='shortlist_candidate']
labeled=[r for r in records if 'v2i' in r['archive']]
random.Random(63042).shuffle(labeled)
splits={r['id']:('test' if i<10 else 'valid' if i<18 else 'train') for i,r in enumerate(labeled)}
counts={}; manifest=[]
with zipfile.ZipFile('D:/Download/Urticaria.v2i.yolov8.zip') as z:
    for r in records:
        split=splits.get(r['id'],'unlabeled'); name=f"{r['id']:03}.jpg"
        dest=root/split/'images'/name;dest.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(audit/r['image'],dest)
        assert hashlib.sha256(dest.read_bytes()).hexdigest()==r['sha256']
        rows=[];multiple=0;excluded=0
        if split!='unlabeled':
            label=str(PurePosixPath(r['source'].replace('/images/','/labels/')).with_suffix('.txt'))
            for line in z.read(label).decode('utf-8-sig').splitlines():
                if not line.strip():continue
                row,kind,cls=detection_row(line)
                if cls==0:continue
                _,x,y,w,h=map(float,row.split()); W,H=r['width'],r['height']
                if (x-w/2)*W<=1 or (y-h/2)*H<=1 or (x+w/2)*W>=W-1 or (y+h/2)*H>=H-1 or min(w*W,h*H)<5:
                    excluded+=1;continue
                multiple+=int(cls==1);rows.append(f'0 {x:.10f} {y:.10f} {w:.10f} {h:.10f}')
            target=root/split/'labels'/f"{r['id']:03}.txt";target.parent.mkdir(parents=True,exist_ok=True)
            target.write_text('\n'.join(rows)+'\n',encoding='utf-8');counts[f'{split}/{name}']=len(rows)
        manifest.append({**r,'split':split,'proxy_count':len(rows) if split!='unlabeled' else None,'multiple_regions_mapped_to_one':multiple,'excluded_edge_small':excluded,'ground_truth_verified':False})
assert len(records)==63 and len(labeled)==52
assert len({r['sha256'] for r in records})==63
(root/'manifest.json').write_text(json.dumps({'seed':63042,'images':manifest,'limitations':['Multiple converted to one proxy region; separable/confluent not resolved','No patient IDs; source filename/hash disjoint only','11 unlabeled images are inference only, never false negative training labels','Not a clinical count benchmark']},indent=2),encoding='utf-8')
(root/'counts.proxy.json').write_text(json.dumps(counts,indent=2),encoding='utf-8')
(root/'data.yaml').write_text('train: train/images\nval: valid/images\ntest: test/images\nnames:\n  0: wheal\n',encoding='utf-8')
archive=root/'MayDay_quality63_experiment.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for p in root.rglob('*'):
        if p.is_file() and p!=archive:z.write(p,p.relative_to(root))
print(json.dumps({'images':63,'train':34,'valid':8,'test':10,'unlabeled_inference_only':11,'proxy_boxes':sum(counts.values()),'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest()},indent=2))
