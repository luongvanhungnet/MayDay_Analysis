"""Package visual working labels, preserving source images and frozen test IDs."""
import json,hashlib,zipfile,html
from pathlib import Path
from PIL import Image,ImageDraw
root=Path('.data/ml/counting63-instance-v1');a=json.loads((root/'annotations.visual.json').read_text())
assert a['coverage']==63
old=Path('.data/ml/quality63-experiment');m=json.loads((old/'manifest.json').read_text(encoding='utf-8'))['images'];lookup={r['id']:r for r in m}
data=root/'dataset';data.mkdir(exist_ok=True);cards=[]
for r in a['images']:
    src=lookup[r['id']];name=f"{r['id']:03}.jpg";raw=(old/src['split']/'images'/name).read_bytes();assert hashlib.sha256(raw).hexdigest()==r['image_sha256']
    folder=data/r['split'];(folder/'images').mkdir(parents=True,exist_ok=True);(folder/'labels').mkdir(parents=True,exist_ok=True)
    (folder/'images'/name).write_bytes(raw)
    (folder/'labels'/f"{r['id']:03}.txt").write_text('\n'.join('0 '+' '.join(f'{v:.8f}' for v in x['box_xywh']) for x in r['instances'])+'\n')
    im=Image.open(folder/'images'/name).convert('RGB');w,h=im.size;draw=ImageDraw.Draw(im)
    for j,obj in enumerate(r['instances'],1):
        x,y,bw,bh=obj['box_xywh'];xy=[(x-bw/2)*w,(y-bh/2)*h,(x+bw/2)*w,(y+bh/2)*h];draw.rectangle(xy,outline='lime',width=1);draw.ellipse([x*w-3,y*h-3,x*w+3,y*h+3],fill='cyan');draw.text((x*w+3,y*h),str(j),fill='yellow')
    (root/'overlays').mkdir(exist_ok=True);im.save(root/'overlays'/name)
    r['excluded_regions']=[{'xyxy':[0,0,1,1],'reason':'no_clear_non_edge_instance_per_visual_working_review','effect':'zero_countable_targets_not_healthy_diagnosis'}] if not r['instances'] else []
    cards.append(f'<article><h2>#{r["id"]} · {r["split"]} · {r["count"]} nốt theo nhãn làm việc</h2><p>{html.escape(r["note"])}</p><div><img src="../quality63-experiment/{src["split"]}/images/{name}"><img src="overlays/{name}"></div></article>')
(data/'annotations.json').write_text(json.dumps(a,indent=2))
(data/'data.yaml').write_text('train: train/images\nval: valid/images\ntest: test/images\nnames:\n  0: wheal\n')
(root/'index.html').write_text('<!doctype html><meta charset="utf-8"><title>63 ảnh — nhãn từng nốt</title><style>body{font:16px system-ui;background:#f3f5f8;margin:24px;color:#183047}article{background:white;padding:18px;margin:20px 0}article div{display:flex;gap:12px}img{width:47%;max-width:512px;object-fit:contain}header{background:#fff0c0;padding:18px}</style><header><h1>63 ảnh — nhãn điểm tâm và box từng nốt</h1>Nhãn làm việc do Codex rà trực quan, không phải nhãn bác sĩ hoặc người dùng đã xác nhận. Box xấp xỉ vùng nhìn thấy, không phải mask. Vùng quá mờ/nhỏ hoặc nốt bị cắt ở mép ảnh không tính. Số 0 nghĩa không có nốt đủ điều kiện đếm theo lượt rà này, không có nghĩa da bình thường. Các nhãn này phải được kiểm tra lại trước khi dùng đánh giá lâm sàng.</header>'+''.join(cards),encoding='utf-8')
bundle=root/'MayDay_counting63_instances.zip'
with zipfile.ZipFile(bundle,'w',zipfile.ZIP_DEFLATED) as z:
    for p in data.rglob('*'):
        if p.is_file():z.write(p,p.relative_to(data))
summary={'images':len(a['images']),'instances':sum(r['count'] for r in a['images']),'splits':{s:sum(r['split']==s for r in a['images']) for s in ['train','valid','test']},'test_counts':{str(r['id']):r['count'] for r in a['images'] if r['split']=='test'},'sha256':hashlib.sha256(bundle.read_bytes()).hexdigest(),'verification':'Codex visual working labels; no independent expert review'}
(root/'dataset-summary.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary,indent=2))
