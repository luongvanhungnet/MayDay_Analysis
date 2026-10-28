"""Build a read-only, offline annotation review pack from the original ZIP.

Heuristics prioritize human review; they never establish a diagnosis or fix labels.
"""
import argparse
import csv
import hashlib
import html
import io
import json
from collections import Counter
from pathlib import Path, PurePosixPath
import zipfile

from PIL import Image, ImageDraw
from prepare_urticaria import NAMES, detection_row


def bounds(row):
    cls, x, y, w, h = map(float, row.split())
    return int(cls), (x-w/2, y-h/2, x+w/2, y+h/2)


def iou(a, b):
    intersection = max(0, min(a[2], b[2])-max(a[0], b[0])) * max(0, min(a[3], b[3])-max(a[1], b[1]))
    union = (a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - intersection
    return intersection/union if union > 0 else 0


def review(archive, output):
    output = Path(output).resolve()
    if output.exists():
        raise FileExistsError('Use a new output directory; existing reviews are preserved.')
    output.mkdir(parents=True)
    (output/'images').mkdir()
    records, flags_count, classes = [], Counter(), Counter()
    cards = []
    colors = ['#00c9ff', '#ff9e00', '#20ff45']
    with zipfile.ZipFile(archive) as z:
        names = z.namelist()
        images = sorted(n for n in names if len(PurePosixPath(n).parts) == 3
                        and PurePosixPath(n).parts[0] in ('train','valid','test')
                        and PurePosixPath(n).parts[1] == 'images'
                        and PurePosixPath(n).suffix.lower() in ('.jpg','.jpeg','.png'))
        for index, name in enumerate(images, 1):
            label = str(PurePosixPath(name.replace('/images/', '/labels/')).with_suffix('.txt'))
            image = Image.open(io.BytesIO(z.read(name))).convert('RGB')
            width, height = image.size
            boxes, details, flags = [], [], []
            if names.count(name) != 1 or names.count(label) != 1:
                flags.append('missing_or_duplicate_member')
            for line_number, line in enumerate(z.read(label).decode('utf-8-sig').splitlines() if label in names else [], 1):
                if not line.strip():
                    continue
                try:
                    row, kind, cls = detection_row(line)
                    _, box = bounds(row)
                    boxes.append((line_number, cls, box))
                    classes[NAMES[cls]] += 1
                    details.append({'line': line_number, 'class': NAMES[cls], 'format': kind, 'box': box})
                    if min(box) < -1e-6 or max(box) > 1+1e-6:
                        flags.append(f'box_outside_image:L{line_number}')
                    if (box[2]-box[0])*width < 5 or (box[3]-box[1])*height < 5:
                        flags.append(f'tiny_box_under_5px:L{line_number}')
                except ValueError as error:
                    flags.append(f'invalid_label:L{line_number}:{error}')
            for i, (line_a, cls_a, a) in enumerate(boxes):
                for line_b, cls_b, b in boxes[i+1:]:
                    overlap = iou(a, b)
                    if cls_a == cls_b and overlap >= 0.9:
                        flags.append(f'near_duplicate_iou90:L{line_a},L{line_b}')
                    if {cls_a, cls_b} == {1,2} and overlap >= 0.7:
                        flags.append(f'single_multiple_iou70:L{line_a},L{line_b}')
            if not any(cls == 0 for _, cls, _ in boxes):
                flags.append('no_body_label_review')
            if not boxes:
                flags.append('empty_labels_verify_negative')
            counts = Counter(NAMES[cls] for _, cls, _ in boxes)
            for flag in flags:
                flags_count[flag.split(':')[0]] += 1
            # Keep originals separate from overlays. Nothing is written into training labels.
            image.save(output/'images'/f'{index:03d}_original.jpg', quality=95)
            overlay = image.copy()
            draw = ImageDraw.Draw(overlay)
            for line_number, cls, box in boxes:
                xy = tuple(v*(width if j%2 == 0 else height) for j,v in enumerate(box))
                draw.rectangle(xy, outline=colors[cls], width=2)
                draw.text((max(0,xy[0]), max(0,xy[1])), f'L{line_number} {NAMES[cls]}', fill=colors[cls], stroke_width=1, stroke_fill='black')
            overlay.save(output/'images'/f'{index:03d}_labels.jpg', quality=95)
            record = {'id': index, 'image': name, 'label': label, 'counts': dict(counts),
                      'flags': flags, 'annotations': details, 'review_status': 'pending'}
            records.append(record)
            cards.append(f'<article data-flagged="{str(bool(flags)).lower()}"><h2>#{index:03d} {html.escape(name)}</h2>'
                         f'<p>{html.escape(str(dict(counts)))}</p><p class="flags">{html.escape("; ".join(flags) or "No geometry flags — semantic review still required")}</p>'
                         f'<div class="pair"><img loading="lazy" src="images/{index:03d}_original.jpg" alt="Original #{index}">'
                         f'<img loading="lazy" src="images/{index:03d}_labels.jpg" alt="Labels #{index}"></div>'
                         '<p>Review: correct class / missing lesions / loose box / overlap / unclear image / wrong disease / patient group unknown.</p></article>')
    report = {'source_sha256': hashlib.sha256(Path(archive).read_bytes()).hexdigest(),
              'images': len(records), 'flagged_images': sum(bool(r['flags']) for r in records),
              'flag_occurrences': dict(flags_count), 'classes': dict(classes), 'records': records,
              'status': 'All images pending human semantic review; flags are heuristics, not confirmed errors.'}
    (output/'review.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    with (output/'review.csv').open('w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerow(['id','image','label','flags','status','reviewer','patient_group','decision','notes'])
        for r in records:
            writer.writerow([r['id'],r['image'],r['label'],'; '.join(r['flags']),'pending','','','',''])
    (output/'index.html').write_text('<!doctype html><meta charset="utf-8"><title>MayDay annotation review</title>'
        '<style>body{font:16px system-ui;background:#10151d;color:#edf2fa;margin:24px}article{padding:16px;border:1px solid #456;margin:18px 0}h2{font-size:16px;overflow-wrap:anywhere}.pair{display:flex;gap:12px;flex-wrap:wrap}.pair img{width:min(46%,640px);height:auto;object-fit:contain}.flags{color:#ffbf66}button{padding:12px}</style>'
        '<h1>MayDay — Annotation review</h1><p>Left: original; right: label overlay. Cyan=Body, orange=Multiple, green=Single. L = original label line.</p>'
        '<p>Geometry flags only prioritize review. All 100 images need human semantic review. Fill review.csv; no labels are automatically changed.</p>'
        '<button onclick="document.querySelectorAll(\'article[data-flagged=false]\').forEach(e=>e.hidden=!e.hidden)">Toggle unflagged images</button>'
        + ''.join(cards), encoding='utf-8')
    return {k:v for k,v in report.items() if k != 'records'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive')
    parser.add_argument('output')
    args = parser.parse_args()
    print(json.dumps(review(args.archive, args.output), indent=2))
