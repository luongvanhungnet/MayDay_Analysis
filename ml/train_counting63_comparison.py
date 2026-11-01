"""Train YOLO baseline and a center-heatmap model against the same visual labels."""
import os,json,zipfile,hashlib,time,random,shutil,csv,math
from pathlib import Path
import numpy as np
import torch
from torch import nn
from torch.utils.data import Dataset,DataLoader
from PIL import Image,ImageEnhance,ImageDraw
from torchvision.transforms.functional import to_tensor,normalize
from ultralytics import YOLO
from counting_point_model import CenterHeatmap,heatmap_target,center_focal_loss,decode_points
from counting_metrics import summarize

GRID=[.1,.15,.2,.25,.3,.4,.5]
def tensor_image(im):return normalize(to_tensor(im),[.485,.456,.406],[.229,.224,.225])

class Images(Dataset):
    def __init__(self,records,data,augment=False):
        self.records=records;self.data=data;self.augment=augment
        self.cached=[Image.open(data/r['split']/'images'/f"{r['id']:03}.jpg").convert('RGB').resize((512,512)) for r in records]
    def __len__(self):return len(self.records)
    def __getitem__(self,i):
        im=self.cached[i].copy();r=self.records[i];pts=[x['center'][:] for x in r['instances']]
        if self.augment:
            if random.random()<.5:im=im.transpose(Image.Transpose.FLIP_LEFT_RIGHT);pts=[[1-x,y] for x,y in pts]
            im=ImageEnhance.Brightness(im).enhance(random.uniform(.8,1.2));im=ImageEnhance.Color(im).enhance(random.uniform(.9,1.1))
        return tensor_image(im),heatmap_target(pts),i

@torch.no_grad()
def point_predictions(model,loader,records):
    model.eval();preds=[]
    for x,_,ids in loader:
        logits=model(x.cuda());batch=decode_points(logits,.1)
        for i,points in zip(ids.tolist(),batch):preds.append({'id':records[i]['id'],'reference_points':[p['center'] for p in records[i]['instances']],'predicted_points':points})
    return preds

def threshold_rows(rows,threshold):return [{**r,'predicted_points':[p for p in r['predicted_points'] if p[2]>=threshold]} for r in rows]
def select_threshold(rows):
    grid=[{'threshold':t,**summarize(threshold_rows(rows,t))} for t in GRID]
    best=min(grid,key=lambda m:(m['MAE'],-m['point_F1'],abs(m['threshold']-.25)))
    return best,grid

def yolo_predictions(model,records,data):
    rows=[]
    for r in records:
        p=model.predict(str(data/r['split']/'images'/f"{r['id']:03}.jpg"),imgsz=512,device=0,conf=.1,iou=.7,max_det=1000,verbose=False)[0]
        h,w=p.orig_shape;points=[]
        for box,score in zip(p.boxes.xyxy.cpu().tolist(),p.boxes.conf.cpu().tolist()):
            a,b,c,d=box
            if a<=1 or b<=1 or c>=w-1 or d>=h-1:continue
            points.append([(a+c)/2/w,(b+d)/2/h,score])
        rows.append({'id':r['id'],'reference_points':[p['center'] for p in r['instances']],'predicted_points':points})
    return rows

def main():
    assert torch.cuda.is_available()
    seed=63042;random.seed(seed);np.random.seed(seed);torch.manual_seed(seed);torch.cuda.manual_seed_all(seed)
    archive=Path('/content/MayDay_counting63_instances.zip');sha=hashlib.sha256(archive.read_bytes()).hexdigest()
    assert sha=='40603507ab532567aab38983af53c198572bc47103770c4aa37ff70d3385552c'
    root=Path('/content/MayDayAI/counting63_comparison')/time.strftime('%Y%m%d_%H%M%S');root.mkdir(parents=True)
    data=root/'dataset';data.mkdir()
    with zipfile.ZipFile(archive) as z:
        for name in z.namelist():
            p=(data/name).resolve();assert p.is_relative_to(data.resolve());p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(z.read(name))
    annotations=json.loads((data/'annotations.json').read_text());records=annotations['images']
    assert len(records)==63 and len({r['image_sha256'] for r in records})==63
    train=[r for r in records if r['split']=='train'];val=[r for r in records if r['split']=='valid'];test=[r for r in records if r['split']=='test']
    assert [r['id'] for r in test]==[7,17,26,30,35,38,41,52,58,95]
    for r in records:assert hashlib.sha256((data/r['split']/'images'/f"{r['id']:03}.jpg").read_bytes()).hexdigest()==r['image_sha256']
    (data/'data.yaml').write_text(f'path: {data}\ntrain: train/images\nval: valid/images\ntest: test/images\nnames:\n  0: wheal\n')
    start=time.perf_counter();yolo=YOLO('yolov8n.pt')
    yolo.train(data=str(data/'data.yaml'),epochs=120,patience=25,imgsz=512,batch=8,device=0,workers=2,amp=True,seed=seed,deterministic=True,project=str(root),name='yolo',mosaic=0,scale=0,translate=0,fliplr=.5,hsv_h=.005,hsv_s=.1,hsv_v=.2,max_det=1000,plots=True)
    yolo_minutes=(time.perf_counter()-start)/60;yolo_dir=Path(yolo.trainer.save_dir);yolo=YOLO(str(yolo_dir/'weights/best.pt'))
    yval=yolo_predictions(yolo,val,data);yb,yg=select_threshold(yval)
    ytest=threshold_rows(yolo_predictions(yolo,test,data),yb['threshold'])
    yreport={'architecture':'YOLOv8n COCO pretrained','training_minutes':yolo_minutes,'epochs':len(list(csv.DictReader((yolo_dir/'results.csv').open()))),'threshold':yb['threshold'],'validation':yb,'validation_grid':yg,'test':summarize(ytest),'per_image':ytest}
    (root/'yolo-report.json').write_text(json.dumps(yreport,indent=2));print('YOLO_RESULT',json.dumps({k:v for k,v in yreport.items() if k not in ['per_image','validation_grid']}),flush=True)
    del yolo;torch.cuda.empty_cache()
    random.seed(seed);np.random.seed(seed);torch.manual_seed(seed)
    model=CenterHeatmap(pretrained=True).cuda();optimizer=torch.optim.AdamW(model.parameters(),lr=1e-4,weight_decay=1e-4)
    train_loader=DataLoader(Images(train,data,True),batch_size=8,shuffle=True,num_workers=0)
    val_loader=DataLoader(Images(val,data),batch_size=4,shuffle=False,num_workers=0)
    test_loader=DataLoader(Images(test,data),batch_size=4,shuffle=False,num_workers=0)
    scaler=torch.amp.GradScaler('cuda');start=time.perf_counter();best_key=(float('inf'),float('inf'));best_epoch=0;history=[]
    for epoch in range(1,201):
        model.train()
        # Tiny batches: freeze running BatchNorm statistics while learning weights.
        for layer in model.modules():
            if isinstance(layer,nn.BatchNorm2d):layer.eval()
        total=0
        for x,y,_ in train_loader:
            optimizer.zero_grad(set_to_none=True)
            with torch.autocast('cuda',dtype=torch.float16):loss=center_focal_loss(model(x.cuda()),y.cuda())
            assert torch.isfinite(loss), 'Non-finite point training loss'
            scaler.scale(loss).backward();scaler.unscale_(optimizer);torch.nn.utils.clip_grad_norm_(model.parameters(),10);scaler.step(optimizer);scaler.update();total+=float(loss)
        if epoch%5==0:
            vb,grid=select_threshold(point_predictions(model,val_loader,val));key=(vb['MAE'],-vb['point_F1'])
            history.append({'epoch':epoch,'loss':total/len(train_loader),'validation':vb})
            print('POINT_PROGRESS',json.dumps(history[-1]),flush=True)
            if key<best_key:
                best_key=key;best_epoch=epoch
                torch.save({'state_dict':model.state_dict(),'threshold':vb['threshold'],'epoch':epoch,'architecture':'resnet18_fpn_stride4_center_heatmap','dataset_sha256':sha},root/'point-best.pt')
            if epoch>=50 and epoch-best_epoch>=40:break
    minutes=(time.perf_counter()-start)/60;ckpt=torch.load(root/'point-best.pt',map_location='cuda',weights_only=True);model.load_state_dict(ckpt['state_dict']);model.eval()
    pb,pg=select_threshold(point_predictions(model,val_loader,val));ptest=threshold_rows(point_predictions(model,test_loader,test),ckpt['threshold'])
    preport={'architecture':'ResNet18 ImageNet pretrained + FPN stride4 center heatmap; custom prototype, not P2PNet','training_minutes':minutes,'epochs':epoch,'best_epoch':best_epoch,'threshold':ckpt['threshold'],'validation':pb,'validation_grid':pg,'history':history,'test':summarize(ptest),'per_image':ptest}
    (root/'point-report.json').write_text(json.dumps(preport,indent=2))
    for method,rows in [('yolo',ytest),('point',ptest)]:
        folder=root/(method+'_test');folder.mkdir(exist_ok=True)
        for r in rows:
            im=Image.open(data/'test/images'/f"{r['id']:03}.jpg").convert('RGB');w,h=im.size;draw=ImageDraw.Draw(im)
            for j,p in enumerate(r['predicted_points'],1):
                x,y=p[:2];draw.ellipse((x*w-4,y*h-4,x*w+4,y*h+4),outline='cyan',width=2);draw.text((x*w+4,y*h),str(j),fill='yellow')
            im.save(folder/f"{r['id']:03}.jpg")
    # Paired bootstrap over images, descriptive only on this small working-label set.
    ys=[abs(len(r['predicted_points'])-len(r['reference_points'])) for r in ytest];ps=[abs(len(r['predicted_points'])-len(r['reference_points'])) for r in ptest]
    rng=np.random.default_rng(seed);diff=np.asarray(ps)-np.asarray(ys);boot=[float(diff[rng.integers(0,len(test),len(test))].mean()) for _ in range(5000)]
    report={'gpu':torch.cuda.get_device_name(0),'dataset_sha256':sha,'annotation_status':annotations['status'],'splits':{'train':len(train),'valid':len(val),'test':len(test)},'input_size':512,'yolo':yreport,'point':preport,'paired_MAE_point_minus_yolo':float(diff.mean()),'paired_bootstrap_95_percentile_interval':np.quantile(boot,[.025,.975]).tolist(),'limitations':['Codex visual working annotations, not independent expert verified counts','Ten test images; no verified patient split','Both methods use identical image IDs and points; YOLO boxes manually approximate visible extents','Different pretraining, architectures, augmentation details and training budgets; comparison of these runs, not isolated causal architecture effect','Zero labels mean no countable visible instance under this review, not healthy skin','No automatic clinical acceptance or replacement of deployed models']}
    (root/'comparison-report.json').write_text(json.dumps(report,indent=2));shutil.copy2(data/'annotations.json',root/'annotations.json')
    for name in ['train_counting63_comparison.py','counting_point_model.py','counting_metrics.py']:shutil.copy2(Path(__file__).parent/name,root/name)
    bundle=Path('/content/MayDay_counting63_comparison.zip')
    with zipfile.ZipFile(bundle,'w',zipfile.ZIP_DEFLATED) as z:
        for p in root.rglob('*'):
            if p.is_file() and not p.is_relative_to(data) and not(p.parent.name=='weights' and p.name!='best.pt'):z.write(p,p.relative_to(root))
    print('COMPARISON_SUMMARY',json.dumps({'gpu':report['gpu'],'split':report['splits'],'yolo':yreport['test'],'point':preport['test'],'paired_difference':report['paired_MAE_point_minus_yolo'],'interval':report['paired_bootstrap_95_percentile_interval'],'bundle':str(bundle)},indent=2),flush=True)

if __name__=='__main__':main()
