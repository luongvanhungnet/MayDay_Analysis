"""Colab T4 trial on quality-screened images; proxy count evaluation only."""
import json, zipfile, hashlib, time, shutil, csv, math
from pathlib import Path
from datetime import datetime
import torch
from ultralytics import YOLO

assert torch.cuda.is_available(), 'T4 GPU required'
archive=Path('/content/MayDay_quality63_experiment.zip')
assert hashlib.sha256(archive.read_bytes()).hexdigest()=='b1a8d7b12ae80ce102cbe91be0980ede2a39610a0d55590d5057eec1d48824d8'
stamp=datetime.now().strftime('%Y%m%d_%H%M%S')
data=Path('/content')/('quality63_'+stamp);data.mkdir()
with zipfile.ZipFile(archive) as z:
    for name in z.namelist():
        p=(data/name).resolve();assert p.is_relative_to(data.resolve())
        p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(z.read(name))
(data/'data.yaml').write_text(f'path: {data}\ntrain: train/images\nval: valid/images\ntest: test/images\nnames:\n  0: wheal\n')
model=YOLO('yolov8n.pt');start=time.perf_counter()
model.train(data=str(data/'data.yaml'),epochs=120,patience=25,imgsz=640,batch=8,device=0,workers=2,amp=True,seed=63042,deterministic=True,project='/content/MayDayAI/quality63',name=stamp,plots=True,mosaic=0,fliplr=.5,hsv_h=.005,hsv_s=.1,hsv_v=.2,max_det=1000)
minutes=(time.perf_counter()-start)/60;out=Path(model.trainer.save_dir);best=YOLO(str(out/'weights/best.pt'))
counts=json.loads((data/'counts.proxy.json').read_text())
def evaluate(split,conf,save=False):
    rows=[]
    for pred in best.predict(str(data/split/'images'),imgsz=640,device=0,conf=conf,iou=.7,max_det=1000,verbose=False):
        h,w=pred.orig_shape;boxes=[]
        for box,score in zip(pred.boxes.xyxy.cpu().tolist(),pred.boxes.conf.cpu().tolist()):
            a,b,c,d=box
            if a>1 and b>1 and c<w-1 and d<h-1 and min(c-a,d-b)>=5:boxes.append({'xyxy':box,'confidence':score})
        name=Path(pred.path).name;ref=counts.get(split+'/'+name)
        rows.append({'image':name,'reference_proxy_count':ref,'predicted_count':len(boxes),'error':len(boxes)-ref if ref is not None else None,'boxes':boxes})
        if save:
            from PIL import Image,ImageDraw
            image=Image.open(pred.path).convert('RGB');draw=ImageDraw.Draw(image)
            for i,box in enumerate(boxes,1):draw.rectangle(box['xyxy'],outline='lime',width=2);draw.text(box['xyxy'][:2],str(i),fill='yellow')
            folder=out/(split+'_counted');folder.mkdir(exist_ok=True);image.save(folder/name)
    return rows
def summary(rows):
    errors=[r['error'] for r in rows];n=len(errors)
    return {'images':n,'MAE_against_proxy':sum(abs(e) for e in errors)/n,'RMSE_against_proxy':math.sqrt(sum(e*e for e in errors)/n),'mean_signed_error':sum(errors)/n,'exact_count_rate':sum(e==0 for e in errors)/n,'within_1_rate':sum(abs(e)<=1 for e in errors)/n,'within_2_rate':sum(abs(e)<=2 for e in errors)/n,'overcount_images':sum(e>0 for e in errors),'undercount_images':sum(e<0 for e in errors),'reference_total':sum(r['reference_proxy_count'] for r in rows),'predicted_total':sum(r['predicted_count'] for r in rows)}
grid=[]
for conf in [.1,.15,.2,.25,.3,.4,.5]:grid.append({'confidence':conf,**summary(evaluate('valid',conf))})
chosen=min(grid,key=lambda r:(r['MAE_against_proxy'],abs(r['confidence']-.25)))['confidence']
metrics=best.val(data=str(data/'data.yaml'),split='test',device=0,imgsz=640,max_det=1000,plots=True,project=str(out),name='test')
rows=evaluate('test',chosen,True);fixed=evaluate('test',.25);unlabeled=evaluate('unlabeled',chosen,True)
report={'model':'quality63_trial','gpu':torch.cuda.get_device_name(0),'training_minutes':minutes,'epochs_completed':len(list(csv.DictReader((out/'results.csv').open()))),'split':{'train':34,'valid':8,'test':10,'unlabeled_inference_only':11},'threshold_selected_on_validation_only':chosen,'validation_threshold_grid':grid,'test_count_metrics':summary(rows),'test_at_fixed_025':summary(fixed),'test_detection_metrics':{k:float(v) for k,v in metrics.results_dict.items()},'per_image':rows,'unlabeled_inference_no_accuracy_claim':unlabeled,'weights_sha256':hashlib.sha256((out/'weights/best.pt').read_bytes()).hexdigest(),'limitations':['Counts compared with original Single/Multiple converted proxy labels, not independently verified wheal counts','Multiple mapped to one region; touching/confluent distinctions unresolved','34 supervised training images only; 11 unlabeled images not used as negatives or pseudo ground truth','No patient IDs; only source-name/hash split separation checked','Old pilot metrics use a different test set and cannot prove improvement']}
(out/'training-report.json').write_text(json.dumps(report,indent=2));shutil.copy2(data/'manifest.json',out/'manifest.json');shutil.copy2(data/'counts.proxy.json',out/'counts.proxy.json');shutil.copy2(__file__,out/'train_quality63.py')
bundle=Path('/content/MayDay_quality63_model.zip')
with zipfile.ZipFile(bundle,'w',zipfile.ZIP_DEFLATED) as z:
    for p in out.rglob('*'):
        if p.is_file() and not(p.parent.name=='weights' and p.name!='best.pt'):z.write(p,p.relative_to(out))
print('FINAL_REPORT',json.dumps(report,indent=2),flush=True)
print('BUNDLE',str(bundle),flush=True)
