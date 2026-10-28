"""Build an honest point-count annotation pilot, preserving unresolved regions."""
import json, zipfile, hashlib, random, io
from pathlib import Path, PurePosixPath
from PIL import Image
from prepare_urticaria import detection_row

def build(archive, selection_file, output):
    output=Path(output)
    if output.exists(): raise FileExistsError('Refusing to overwrite annotation work')
    selected=json.loads(Path(selection_file).read_text())
    assert len(selected)==50 and len(set(selected))==50
    output.mkdir(parents=True);(output/'images').mkdir()
    records=[];hashes=set()
    with zipfile.ZipFile(archive) as z:
        for i,name in enumerate(selected,1):
            raw=z.read(name);sha=hashlib.sha256(raw).hexdigest()
            assert sha not in hashes, 'Duplicate selected image'
            hashes.add(sha)
            image=Image.open(io.BytesIO(raw));w,h=image.size
            label=str(PurePosixPath(name.replace('/images/','/labels/')).with_suffix('.txt'))
            objects=[];excluded=[];unresolved=[]
            for line_id,line in enumerate(z.read(label).decode('utf-8-sig').splitlines(),1):
                if not line.strip(): continue
                row,kind,cls=detection_row(line)
                _,x,y,bw,bh=map(float,row.split())
                box=[(x-bw/2)*w,(y-bh/2)*h,(x+bw/2)*w,(y+bh/2)*h]
                obj={'source_line':line_id,'source_class':['Body','Multiple','Single'][cls], 'bbox_xyxy':box,'source_format':kind}
                if cls==0: continue
                # A geometrical boundary/size candidate is not a clinical judgement.
                if min(box[0],box[1])<=1 or box[2]>=w-1 or box[3]>=h-1:
                    excluded.append({**obj,'reason':'edge_candidate','needs_review':True});continue
                if min(bw*w,bh*h)<5:
                    excluded.append({**obj,'reason':'small_candidate_under_5px','needs_review':True});continue
                if cls==1:
                    unresolved.append({**obj,'reason':'decide_separate_touching_vs_confluent','resolved':False});continue
                objects.append({**obj,'x':x*w,'y':y*h,'origin':'source_single_center','reviewed':False})
            dest=f'{i:03d}'+PurePosixPath(name).suffix
            (output/'images'/dest).write_bytes(raw)
            records.append({'id':i,'image':'images/'+dest,'source_image':name,'source_sha256':sha,
                'source_group':PurePosixPath(name).name.split('.rf.')[0],'patient_group':None,
                'width':w,'height':h,'points':objects,'excluded':excluded,'unresolved':unresolved,
                'status':'draft','count_verified':None,'proposed_single_count':len(objects)})
    # These are proposed future splits, not a benchmark on previously unseen images.
    for i,r in enumerate(records): r['split']='train' if i<35 else 'valid' if i<45 else 'test'
    data={'version':'counting-pilot-50-v1','label_type':'point_instances','status':'DRAFT_NOT_TRAIN_READY',
        'rules':{'touching_separable':2,'confluent_no_boundary':1,'edge':'exclude','unclear':'exclude',
                 'small_threshold':'5px candidate only; requires visual confirmation at source resolution'},
        'provenance':'Single centers are initial proposals from original labels; Multiple regions unresolved. No fabricated instance masks.',
        'split_warning':'All selected images came from previous model training data. Do not evaluate that old model as an independent benchmark. Patient groups unknown.',
        'source_archive_sha256':hashlib.sha256(Path(archive).read_bytes()).hexdigest(),'images':records}
    (output/'annotations.draft.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    summary={'images':len(records),'proposed_splits':{'train':35,'valid':10,'test':5},
             'proposed_single_points':sum(len(r['points']) for r in records),
             'unresolved_multiple_regions':sum(len(r['unresolved']) for r in records),
             'excluded_candidates':sum(len(r['excluded']) for r in records),
             'verified_images':0,'train_ready':False}
    (output/'validation.json').write_text(json.dumps(summary,indent=2))
    template=(Path(__file__).parent/'counting-review.template.html').read_text(encoding='utf-8')
    (output/'index.html').write_text(template.replace('PAYLOAD',json.dumps(data,ensure_ascii=False).replace('<',r'\u003c')),encoding='utf-8')
    return data,summary

if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('archive');p.add_argument('selection');p.add_argument('output');a=p.parse_args()
    _,summary=build(a.archive,a.selection,a.output);print(json.dumps(summary,indent=2))
