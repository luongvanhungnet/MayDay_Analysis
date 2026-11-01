"""Private local worker: image bytes on stdin, JSON on stdout. No image persistence."""
import sys
import io
import json
import time
from contextlib import redirect_stdout
from pathlib import Path

def main():
    model_id = sys.argv[1]
    root = Path(__file__).resolve().parents[1]
    config = {
        'lesions': (root/'.data/ml/yolov8n_20261028_164928/weights/best.pt', ['Body','Multiple','Single']),
        'counting': (root/'.data/ml/counting_pilot_50/weights/best.pt', ['wheal']),
        'skin': (root/'.data/ml/v4_two_class_20261029/weights/best.pt', ['normal skin','urticaria']),
    }
    path, names = config[model_id]
    assert path.is_file(), 'Model weights missing'
    raw = sys.stdin.buffer.read(8*1024*1024+1)
    if not raw or len(raw)>8*1024*1024:
        raise ValueError('Image must be between 1 byte and 8 MiB')
    with redirect_stdout(sys.stderr):
        from PIL import Image, ImageOps
        Image.MAX_IMAGE_PIXELS = 16_000_000
        image = Image.open(io.BytesIO(raw))
        if image.format not in ('JPEG','PNG','WEBP'): raise ValueError('Unsupported image')
        if image.width*image.height>16_000_000: raise ValueError('Image too large')
        image = ImageOps.exif_transpose(image).convert('RGB')
        import torch
        torch.set_num_threads(1)
        from ultralytics import YOLO
        model = YOLO(str(path))
        if [model.names[i] for i in range(len(names))] != names: raise ValueError('Unexpected model labels')
        start = time.perf_counter()
        prediction = model.predict(image, device='cpu', imgsz=640, conf=0.25, max_det=1000, verbose=False)[0]
        result = {'id':model_id, 'width':image.width,'height':image.height,
                  'elapsed_ms':round((time.perf_counter()-start)*1000),
                  'detections':[{'label':model.names[int(box.cls.item())], 'confidence':round(float(box.conf.item()),6),
                                 'xyxy':[round(float(v),2) for v in box.xyxy[0].tolist()]} for box in prediction.boxes]}
    if model_id == 'counting':
        counted=[]; ignored=[]
        for box in result['detections']:
            a,b,c,d=box['xyxy']
            if a<=1 or b<=1 or c>=result['width']-1 or d>=result['height']-1 or min(c-a,d-b)<5:
                ignored.append(box)
            else: counted.append(box)
        result['detections']=counted
        result['count']=len(counted)
        result['excluded_count']=len(ignored)
        result['count_status']='experimental_proxy_not_verified_nodule_count'
    print(json.dumps(result))

if __name__=='__main__': main()
