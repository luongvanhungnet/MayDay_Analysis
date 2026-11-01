"""Train one-class counting proxy pilot; no expert-count accuracy claim."""
import json, zipfile, hashlib, time, shutil, sys
from pathlib import Path
from datetime import datetime
import torch
from ultralytics import YOLO
from google.colab import drive
assert torch.cuda.is_available()
# Local runtime checkpointing; download bundle before disconnecting.
archive=Path('/content/MayDay_counting_50_approved_proxy.zip')
assert hashlib.sha256(archive.read_bytes()).hexdigest()=='8ec1d37a9b1c5c16b2712cd9f5c9a485c605072d14f5b0dc5a1f3336e8e2916f'
stamp=datetime.now().strftime('%Y%m%d_%H%M%S')
data=Path('/content')/('counting50_'+stamp);data.mkdir()
with zipfile.ZipFile(archive) as z:
    for name in z.namelist():
        dest=(data/name).resolve();assert dest.is_relative_to(data.resolve());dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(z.read(name))
(data/'data.yaml').write_text(f'path: {data.as_posix()}\ntrain: train/images\nval: valid/images\ntest: test/images\nnames:\n  0: wheal\n')
root=Path('/content/MayDayAI/counting_pilot_50');root.mkdir(parents=True,exist_ok=True);shutil.copy2(archive,root/archive.name)
model=YOLO('yolov8n.pt');start=time.perf_counter()
model.train(data=str(data/'data.yaml'),epochs=100,patience=20,imgsz=640,batch=8,device=0,workers=2,amp=True,seed=42,project=str(root/'runs'),name='counting50_'+stamp,save=True,save_period=10,plots=True,mosaic=0,fliplr=0.5,hsv_h=0.005,hsv_s=0.1,hsv_v=0.2)
minutes=(time.perf_counter()-start)/60;out=Path(model.trainer.save_dir)
best=YOLO(str(out/'weights/best.pt'))
metrics=best.val(data=str(data/'data.yaml'),split='test',device=0,imgsz=640,plots=True,project=str(out),name='test')
counts=json.loads((data/'counts.proxy.json').read_text());evaluation=[]
for pred in best.predict(source=str(data/'test/images'),device=0,imgsz=640,conf=0.25,save=True,project=str(out),name='test_predictions'):
    h,w=pred.orig_shape;kept=[]
    for b in pred.boxes.xyxy.cpu().tolist():
        a,c,d,e=b
        if a>1 and c>1 and d<w-1 and e<h-1 and min(d-a,e-c)>=5:kept.append(b)
    actual=counts['test/'+Path(pred.path).name];evaluation.append({'image':Path(pred.path).name,'proxy_reference_count':actual,'predicted_count':len(kept),'absolute_error_against_proxy':abs(actual-len(kept))})
report={'model':'counting_pilot_50','classes':['wheal'],'training_minutes':minutes,'test_images':len(evaluation),'test_metrics':{k:float(v) for k,v in metrics.results_dict.items()},'proxy_count_MAE':sum(x['absolute_error_against_proxy'] for x in evaluation)/len(evaluation),'per_image':evaluation,'weights_sha256':hashlib.sha256((out/'weights/best.pt').read_bytes()).hexdigest(),'limitations':['USER DEFAULT APPROVED PROXY LABELS, NOT EXPERT COUNTS','Each unresolved Multiple mapped to one coarse object','Edge/small exclusion is heuristic; unclear lesions not independently reviewed','Five held-out images only; patient split unknown','Do not expand automatically based on these proxy metrics']}
(out/'training-report.json').write_text(json.dumps(report,indent=2));shutil.copy2(data/'manifest.json',out/'manifest.json');shutil.copy2(data/'counts.proxy.json',out/'counts.proxy.json');shutil.copy2(__file__,out/'train_counting_pilot.py')
bundle=Path('/content/MayDay_counting50_model.zip')
with zipfile.ZipFile(bundle,'w',zipfile.ZIP_DEFLATED) as z:
    for p in out.rglob('*'):
        if p.is_file() and not (p.parent.name=='weights' and p.name!='best.pt'):z.write(p,p.relative_to(out))
shutil.copy2(bundle,root/bundle.name)
print('FINAL_REPORT',json.dumps(report,indent=2),flush=True);print('BUNDLE',bundle,flush=True)
