import { useEffect, useState } from 'react';
import { api } from './api';
import { ErrorBox } from './ui';
type Detection = { label: string; confidence: number; xyxy: number[] };
type Result = { status: string; elapsed_ms: number; models: { id: string; count?: number; excluded_count?: number; width: number; height: number; detections: Detection[] }[] };
export default function ParallelAI() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!file) { setUrl(''); return; } const next = URL.createObjectURL(file); setUrl(next); return () => URL.revokeObjectURL(next); }, [file]);
  async function analyze() {
    if (!file) return;
    setError(''); setResult(null);
    if (file.size > 8 * 1024 * 1024) { setError('Ảnh tối đa 8 MB.'); return; }
    setBusy(true);
    const body = new FormData(); body.append('image', file);
    try { setResult(await api<Result>('/ai/analyze', { method: 'POST', body })); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <section style={{ padding: 24 }}>
    <h1>Phân tích ảnh bằng ba model</h1>
    <p>Thử nghiệm nhận diện vùng da và tổn thương. Kết quả không xác nhận chẩn đoán hoặc điểm AUAS. Ảnh và kết quả không được lưu vào hồ sơ.</p>
    <label>Chọn ảnh JPEG, PNG hoặc WebP (tối đa 8 MB)
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null); setError(''); }} />
    </label>
    <button type="button" disabled={!file || busy} onClick={() => void analyze()}>{busy ? 'Đang chạy cả ba model…' : 'Phân tích ảnh'}</button>
    <ErrorBox message={error} />
    {result && <p role="status"><strong>{result.status === 'conflicting' ? 'Hai model có kết quả mâu thuẫn — cần xem lại ảnh.' : result.status === 'concordant' ? 'Cả hai model phát hiện vùng nghi tổn thương — cần người có chuyên môn đánh giá.' : 'Chưa đủ bằng chứng nhất quán — không kết luận da bình thường.'}</strong> Thời gian: {(result.elapsed_ms / 1000).toFixed(1)} giây.</p>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24 }}>
      {result ? result.models.map(model => <article key={model.id}>
        <h2>{model.id === 'lesions' ? 'Vùng tổn thương: Body / Multiple / Single' : model.id === 'skin' ? 'Vùng da: normal skin / urticaria' : 'Đếm thử nghiệm: wheal'}</h2>
        <div style={{ position: 'relative', width: '100%' }}>
          <img src={url} alt="Ảnh được phân tích" style={{ display: 'block', width: '100%' }} />
          <svg viewBox={`0 0 ${model.width} ${model.height}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-label="Khung dự đoán">
            {model.detections.map((d, i) => <g key={i}><rect x={d.xyxy[0]} y={d.xyxy[1]} width={d.xyxy[2] - d.xyxy[0]} height={d.xyxy[3] - d.xyxy[1]} fill="none" stroke={model.id === 'skin' ? '#ff9600' : '#00d76f'} strokeWidth={Math.max(1, model.width / 250)} /><text x={d.xyxy[0]} y={Math.max(14, d.xyxy[1])} fill="white" stroke="black" strokeWidth="0.3" fontSize={Math.max(12, model.width / 35)}>{d.label} {(d.confidence * 100).toFixed(0)}%</text></g>)}
          </svg>
        </div>
        {model.id === 'counting' && <p><strong>Số đối tượng ước tính: {model.count}</strong> · Loại {model.excluded_count} khung nhỏ/sát mép. Nhãn hợp lưu còn mang tính xấp xỉ; chưa phải số nốt chuẩn.</p>}
        <p>{model.detections.length} vùng dự đoán; ngưỡng confidence 0,25.</p>
        <details><summary>Xem tọa độ và confidence</summary><pre style={{ maxHeight: 250, overflow: 'auto' }}>{JSON.stringify(model.detections, null, 2)}</pre></details>
      </article>) : url && <img src={url} alt="Ảnh chờ phân tích" style={{ maxWidth: '100%', maxHeight: 480 }} />}
    </div>
    {result && <p>Confidence của ba model được giữ riêng, không cộng hoặc lấy trung bình. Số vùng không tương đương số nốt lâm sàng.</p>}
  </section>;
}
