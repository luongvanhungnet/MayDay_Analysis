"""Screen original groups, never call numerical IQA a verified counting annotation."""
import argparse,hashlib,io,json,zipfile
from pathlib import Path
from collections import defaultdict,Counter
import cv2
import numpy as np
from PIL import Image,ImageDraw

def audit(archives, output):
    output=Path(output);output.mkdir(parents=True,exist_ok=False)
    (output/'images').mkdir();records=[]
    for archive in archives:
        with zipfile.ZipFile(archive) as z:
            groups=defaultdict(list)
            for n in z.namelist():
                if '/images/' in n and Path(n).suffix.lower() in ('.jpg','.jpeg','.png'):
                    groups[Path(n).name.split('.rf.')[0]].append(n)
            for group,names in sorted(groups.items()):
                # Original hold-out exports preferred over augmented training variants.
                name=min(names,key=lambda n:({'test':0,'valid':1,'train':2}.get(n.split('/')[0],3),n))
                raw=z.read(name);im=Image.open(io.BytesIO(raw)).convert('RGB');array=np.array(im)
                gray=cv2.cvtColor(array,cv2.COLOR_RGB2GRAY)
                standard=cv2.resize(gray,(256,256),interpolation=cv2.INTER_AREA)
                sharp=float(cv2.Laplacian(standard,cv2.CV_64F).var())
                contrast=float(np.percentile(gray,95)-np.percentile(gray,5))
                mean=float(gray.mean());clipped=float(((gray<8)|(gray>247)).mean())
                reasons=[]
                if min(im.size)<480:reasons.append('short_side_under_480')
                if sharp<35:reasons.append('low_detail_or_blur_candidate')
                if contrast<45:reasons.append('low_contrast_candidate')
                if mean<40 or mean>220:reasons.append('exposure_candidate')
                if clipped>.4:reasons.append('large_clipped_area_candidate')
                index=len(records)+1;filename=f'{index:03d}.jpg';(output/'images'/filename).write_bytes(raw)
                records.append({'id':index,'archive':Path(archive).name,'source':name,'source_group':group,'variants':len(names),'sha256':hashlib.sha256(raw).hexdigest(),'width':im.width,'height':im.height,'laplacian_variance_256':round(sharp,2),'contrast_p95_p5':contrast,'mean_luminance':round(mean,2),'clipped_fraction':round(clipped,3),'flags':reasons,'image':'images/'+filename,'status':'needs_visual_review','count_labels':'individual_instances' if 'v2i' in str(archive) else 'whole_image_skin_class_only'})
    for page in range((len(records)+11)//12):
        sheet=Image.new('RGB',(1600,960),'#ffffff');draw=ImageDraw.Draw(sheet)
        for j,row in enumerate(records[page*12:(page+1)*12]):
            im=Image.open(output/row['image']);im.thumbnail((390,280));x=j%4*400;y=j//4*320
            sheet.paste(im,(x,y+35));draw.text((x+4,y+3),f"#{row['id']:03d} {row['archive']} L={row['laplacian_variance_256']}",fill='black');draw.text((x+4,y+18),' / '.join(row['flags']) or 'numeric pass; visual review required',fill='red' if row['flags'] else 'green')
        sheet.save(output/f'contact-{page+1:02d}.jpg')
    report={'records':records,'unique_source_name_groups':len(records),'numeric_pass':sum(not r['flags'] for r in records),'status':'screening only; no validated count labels added','thresholds':{'short_side_min':480,'laplacian_variance_at_256_min':35,'contrast_p95_p5_min':45,'mean_range':[40,220],'clipped_fraction_max':.4}}
    (output/'quality-audit.json').write_text(json.dumps(report,indent=2))
    print(json.dumps({k:v for k,v in report.items() if k!='records'},indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('output');p.add_argument('archives',nargs='+');a=p.parse_args();audit(a.archives,a.output)
