"""Build local, auditable count results gallery from downloaded experiment output."""
import json,html
from pathlib import Path
root=Path('.data/ml/quality63-experiment/model')
r=json.loads((root/'training-report.json').read_text(encoding='utf-8'))
m=r['test_count_metrics']
cards=[]
for split,key in [('test','per_image'),('unlabeled','unlabeled_inference_no_accuracy_claim')]:
    for row in r[key]:
        name=row['image'];ref=row['reference_proxy_count']
        text=f"{name}: dự đoán {row['predicted_count']} | nhãn quy đổi {ref} | lệch {row['error']}" if ref is not None else f"{name}: dự đoán {row['predicted_count']} — chưa có nhãn để đo độ đúng"
        cards.append(f'<article><h3>{html.escape(text)}</h3><div><figure><figcaption>Ảnh gốc</figcaption><img src="../{split}/images/{name}"></figure><figure><figcaption>Vùng được đếm</figcaption><img src="{split}_counted/{name}"></figure></div></article>')
page='''<!doctype html><html lang="vi"><meta charset="utf-8"><title>Thử nghiệm đếm — 63 ảnh chọn lọc</title><style>body{font:16px system-ui;background:#f4f7fa;color:#183047;margin:30px;max-width:1300px}article{background:white;padding:20px;margin:20px 0;border-radius:12px}article div{display:flex;gap:15px}figure{margin:0;width:50%}img{max-width:100%}pre{white-space:pre-wrap}.warning{background:#fff2ce;padding:20px}</style><h1>Kết quả thử nghiệm 63 ảnh chọn lọc</h1><p class="warning">34 ảnh train / 8 validation / 10 test; 11 ảnh chưa có nhãn chỉ chạy dự đoán. Các con số tham chiếu là nhãn Single/Multiple quy đổi, chưa phải số nốt được xác nhận độc lập. Một vùng Multiple vẫn được tính là một đối tượng. Chưa đáp ứng đầy đủ quy tắc tách/chạm/hợp lưu.</p>'''
page+=f'<p>GPU: {r["gpu"]}; {r["epochs_completed"]} epoch; {r["training_minutes"]:.2f} phút. Confidence chọn từ validation: {r["threshold_selected_on_validation_only"]}.</p>'
page+=f'<p>MAE: <b>{m["MAE_against_proxy"]:.2f} vùng/ảnh</b>; đúng hoàn toàn {m["exact_count_rate"]:.0%}; ±1: {m["within_1_rate"]:.0%}; ±2: {m["within_2_rate"]:.0%}. Tổng tham chiếu {m["reference_total"]}, dự đoán {m["predicted_total"]}.</p>'
page+=''.join(cards)+'<h2>Báo cáo số liệu</h2><pre>'+html.escape(json.dumps(r,ensure_ascii=False,indent=2))+'</pre></html>'
(root/'index.html').write_text(page,encoding='utf-8')
print(root/'index.html')
