import { useState, type FormEvent } from "react";
import {
  Activity,
  Bell,
  BellRing,
  CheckCheck,
  ChevronDown,
  ImagePlus,
  Plus,
  Trash2,
} from "lucide-react";
import { patch, post, put, remove, upload } from "./api";
import type {
  LesionEpisode,
  LesionLocation,
  Media,
  MedicalRecord,
  Notification,
  Patient,
  Scores,
  User,
} from "./types";
import { patientName, rows, userRole } from "./types";
import {
  Badge,
  Button,
  Card,
  date,
  Empty,
  ErrorBox,
  Field,
  Loading,
  Modal,
  PageTitle,
  Success,
  useResource,
} from "./ui";
import { MediaImage } from "./records";

export function TrackingPage({ user }: { user: User }) {
  const isPatient = userRole(user) === "patient";
  const [patientId, setPatientId] = useState(
      isPatient ? user.patient?.id || user.id : "",
    ),
    [modal, setModal] = useState<"score" | "episode" | null>(null),
    [patientSearch, setPatientSearch] = useState(""),
    [success, setSuccess] = useState("");
  const patients = useResource<Patient[]>(
      !isPatient
        ? `/doctor/patients/search?search=${encodeURIComponent(patientSearch)}`
        : null,
    ),
    scores = useResource<Scores>(
      patientId ? `/uas7-scores/patient/${patientId}` : null,
    ),
    episodes = useResource<LesionEpisode[]>(
      patientId
        ? isPatient
          ? "/lesion-episodes/my"
          : `/lesion-episodes/patient/${patientId}`
        : null,
    ),
    records = useResource<MedicalRecord[]>(
      isPatient ? `/medical_records/patients/${patientId}/history` : null,
    );
  const list = scores.data?.scores || [],
    summary = scores.data?.weekly_summary;
  const scoreTotal = (score: import("./types").Score) =>
    score.daily_score ??
    score.total_score ??
    (score.iss7 ?? score.hives_score ?? 0) +
      (score.hss7 ?? score.itch_score ?? 0);
  return (
    <>
      <PageTitle
        eyebrow="CHĂM SÓC LIÊN TỤC"
        title="Theo dõi mề đay"
        description="Thang điểm UAS7 và hình ảnh tiến triển của các đợt tổn thương."
        action={
          isPatient && (
            <Button onClick={() => setModal("score")}>
              <Plus size={18} />
              Chấm điểm hôm nay
            </Button>
          )
        }
      />
      {!isPatient && (
        <Card className="patient-picker">
          <Field label="Tìm bệnh nhân">
            <input
              placeholder="Tên hoặc số điện thoại…"
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
            />
          </Field>
          <Field label="Chọn bệnh nhân để xem tiến triển">
            <select
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
            >
              <option value="">Chọn bệnh nhân</option>
              {rows(patients.data).map((p) => (
                <option key={p.id} value={p.id}>
                  {patientName(p)}
                </option>
              ))}
            </select>
          </Field>
          <ErrorBox message={patients.error} />
        </Card>
      )}
      <Success message={success} />
      {!patientId ? (
        <Card>
          <Empty
            title="Chọn bệnh nhân để bắt đầu"
            text="Dữ liệu theo dõi được hiển thị theo quyền truy cập hồ sơ của bác sĩ."
          />
        </Card>
      ) : (
        <>
          <div className="tracking-grid">
            <Card
              title="Hoạt động mề đay · UAS7"
              description="Tổng điểm của 7 ngày gần nhất"
            >
              <ErrorBox message={scores.error} />
              {scores.loading ? (
                <Loading />
              ) : (
                <>
                  <div className="uas-summary">
                    <span className="uas-icon">
                      <Activity size={32} />
                    </span>
                    <div>
                      <strong>
                        {summary?.uas7 ?? summary?.total ?? "—"}
                        <small>/ 42</small>
                      </strong>
                      <span>
                        {summary?.severity || "Cần đủ 7 ngày để tính UAS7"}
                      </span>
                    </div>
                    <div className="uas-days">
                      <strong>{summary?.days_recorded ?? list.length}</strong>
                      <span>ngày đã ghi nhận</span>
                    </div>
                  </div>
                  {list.length ? (
                    <div
                      className="score-chart"
                      role="img"
                      aria-label="Biểu đồ điểm UAS hằng ngày từ 0 đến 6"
                    >
                      {[...list]
                        .slice(0, 7)
                        .reverse()
                        .map((s) => (
                          <div className="score-bar-column" key={s.id}>
                            <span>{scoreTotal(s)}</span>
                            <div className="score-bar-track">
                              <div
                                className="score-bar"
                                style={{
                                  height: `${Math.max(4, (scoreTotal(s) / 6) * 100)}%`,
                                }}
                              />
                            </div>
                            <small>
                              {new Date(s.score_date).toLocaleDateString(
                                "vi-VN",
                                { day: "2-digit", month: "2-digit" },
                              )}
                            </small>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <Empty
                      title="Chưa có điểm theo dõi"
                      text="Ghi nhận điểm sẩn và ngứa mỗi ngày để theo dõi mức độ bệnh."
                    />
                  )}
                </>
              )}
            </Card>
            <Card
              title="Hiểu về UAS7"
              description="Thang điểm hoạt động mề đay"
            >
              <div className="uas-explainer">
                <p>
                  Mỗi ngày, ghi nhận mức độ <strong>sẩn phù</strong> và{" "}
                  <strong>ngứa</strong> trên thang điểm từ 0 đến 3.
                </p>
                <div>
                  <span>0</span>
                  <p>Không có triệu chứng</p>
                </div>
                <div>
                  <span>1</span>
                  <p>Triệu chứng nhẹ</p>
                </div>
                <div>
                  <span>2</span>
                  <p>Triệu chứng vừa</p>
                </div>
                <div>
                  <span>3</span>
                  <p>Triệu chứng nặng</p>
                </div>
                <small>Điểm hằng ngày: 0–6 · Tổng 7 ngày: 0–42</small>
              </div>
            </Card>
          </div>
          <Card
            title="Nhật ký điểm hằng ngày"
            description="Một lần ghi nhận cho mỗi ngày"
          >
            <ErrorBox message={scores.error} />
            {scores.loading ? (
              <Loading />
            ) : !list.length ? (
              <Empty title="Chưa có nhật ký" />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Điểm sẩn (ISS)</th>
                      <th>Điểm ngứa (HSS)</th>
                      <th>Tổng ngày</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((s) => (
                      <tr key={s.id}>
                        <td>{date(s.score_date)}</td>
                        <td>{s.iss7 ?? s.hives_score}</td>
                        <td>{s.hss7 ?? s.itch_score}</td>
                        <td>
                          <strong className="score-value">
                            {scoreTotal(s)} / 6
                          </strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card
            title="Các đợt tổn thương da"
            description="Theo dõi khởi phát, đỉnh điểm và hồi phục"
            action={
              isPatient && (
                <Button variant="secondary" onClick={() => setModal("episode")}>
                  <Plus size={16} />
                  Ghi nhận đợt mới
                </Button>
              )
            }
          >
            <ErrorBox message={episodes.error} />
            {episodes.loading ? (
              <Loading />
            ) : !rows(episodes.data).length ? (
              <Empty
                title="Chưa có đợt tổn thương"
                text="Ghi nhận từng đợt bùng phát và thêm ảnh ở các mốc tiến triển."
              />
            ) : (
              rows(episodes.data).map((episode) => (
                <EpisodeView
                  key={episode.id}
                  episode={episode}
                  isPatient={isPatient}
                  onChanged={episodes.reload}
                />
              ))
            )}
          </Card>
        </>
      )}
      {modal === "score" && (
        <ScoreModal
          records={rows(records.data)}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            scores.reload();
            setSuccess("Đã ghi nhận điểm theo dõi hôm nay.");
          }}
        />
      )}{" "}
      {modal === "episode" && (
        <EpisodeModal
          records={rows(records.data)}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            episodes.reload();
            setSuccess("Đã tạo đợt theo dõi tổn thương.");
          }}
        />
      )}
      {patientId && <MediaGallery userId={patientId} canDelete={isPatient} />}
    </>
  );
}
function MediaGallery({
  userId,
  canDelete,
}: {
  userId: string;
  canDelete: boolean;
}) {
  const media = useResource<Media[]>(`/image-attachments/user/${userId}`),
    [error, setError] = useState("");
  async function erase(id: string) {
    setError("");
    try {
      await remove(`/image-attachments/${id}`);
      media.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Card
      title="Kho ảnh lâm sàng"
      description="Ảnh được tải lên và bảo vệ theo quyền truy cập"
    >
      <ErrorBox message={error || media.error} />
      {media.loading ? (
        <Loading />
      ) : !rows(media.data).length ? (
        <Empty title="Chưa có ảnh đính kèm" />
      ) : (
        <div className="media-gallery">
          {rows(media.data).map((item) => (
            <article key={item.id}>
              <MediaImage id={item.id} />
              <div>
                <small>
                  {item.original_name || item.filename || item.id.slice(0, 8)}
                </small>
                {canDelete && (
                  <button
                    className="icon-button danger-text"
                    aria-label="Xóa ảnh"
                    onClick={() => void erase(item.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}
function ScoreModal({
  records,
  onClose,
  onSaved,
}: {
  records: MedicalRecord[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const localDate = new Date().toLocaleDateString("en-CA"),
    [day, setDay] = useState(localDate),
    [itch, setItch] = useState(0),
    [hives, setHives] = useState(0),
    [record, setRecord] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("/uas7-scores", {
        score_date: day,
        iss7: hives,
        hss7: itch,
        ...(record ? { medical_record_id: record } : {}),
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Chấm điểm theo dõi hằng ngày" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <Field label="Ngày ghi nhận" required>
            <input
              type="date"
              value={day}
              max={localDate}
              onChange={(e) => setDay(e.target.value)}
              required
            />
          </Field>
          <Field label="Hồ sơ liên quan">
            <select value={record} onChange={(e) => setRecord(e.target.value)}>
              <option value="">Không gắn hồ sơ cụ thể</option>
              {records.map((r) => (
                <option key={r.id} value={r.id}>
                  HS · {r.id.slice(0, 8)} · {date(r.created_at)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Mức độ sẩn phù (ISS)">
            <select
              value={hives}
              onChange={(e) => setHives(Number(e.target.value))}
            >
              <option value={0}>0 · Không có sẩn phù</option>
              <option value={1}>1 · Dưới 20 sẩn / 24 giờ</option>
              <option value={2}>2 · 20–50 sẩn / 24 giờ</option>
              <option value={3}>3 · Trên 50 sẩn hoặc mảng lớn</option>
            </select>
          </Field>
          <Field label="Mức độ ngứa (HSS)">
            <select
              value={itch}
              onChange={(e) => setItch(Number(e.target.value))}
            >
              <option value={0}>0 · Không ngứa</option>
              <option value={1}>1 · Nhẹ, không gây khó chịu</option>
              <option value={2}>2 · Vừa, gây khó chịu</option>
              <option value={3}>
                3 · Nặng, ảnh hưởng hoạt động / giấc ngủ
              </option>
            </select>
          </Field>
          <div className="total-score">
            Tổng điểm hôm nay <strong>{itch + hives} / 6</strong>
          </div>
          <ErrorBox message={error} />
        </div>
        <div className="modal-footer">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" busy={busy}>
            Lưu điểm
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function EpisodeModal({
  records,
  onClose,
  onSaved,
}: {
  records: MedicalRecord[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [recordId, setRecordId] = useState(""),
    [name, setName] = useState(""),
    [tags, setTags] = useState<string[]>([]),
    [medications, setMedications] = useState(""),
    [notes, setNotes] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("/lesion-episodes", {
        medical_record_id: recordId,
        name,
        started_at: new Date().toISOString(),
        context_tags: tags,
        medications,
        notes,
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Ghi nhận đợt tổn thương" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <Field label="Tên đợt tổn thương" required>
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Bùng phát sau vận động"
            />
          </Field>
          <Field label="Hồ sơ liên quan" required>
            <select
              required
              value={recordId}
              onChange={(e) => setRecordId(e.target.value)}
            >
              <option value="">Chọn hồ sơ</option>
              {records
                .filter((r) => r.status !== "completed")
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    HS · {r.id.slice(0, 8)} · {date(r.created_at)}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Bối cảnh khởi phát">
            <div className="tag-choices">
              {[
                "Sau ăn",
                "Vận động",
                "Căng thẳng",
                "Thay đổi thời tiết",
                "Dùng thuốc",
                "Không rõ",
              ].map((tag) => (
                <label
                  className={tags.includes(tag) ? "selected" : ""}
                  key={tag}
                >
                  <input
                    type="checkbox"
                    checked={tags.includes(tag)}
                    onChange={(e) =>
                      setTags(
                        e.target.checked
                          ? [...tags, tag]
                          : tags.filter((t) => t !== tag),
                      )
                    }
                  />
                  {tag}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Thuốc đã dùng">
            <input
              value={medications}
              onChange={(e) => setMedications(e.target.value)}
            />
          </Field>
          <Field label="Ghi chú">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
          <ErrorBox message={error} />
        </div>
        <div className="modal-footer">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" busy={busy}>
            Tạo đợt theo dõi
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function EpisodeView({
  episode,
  isPatient,
  onChanged,
}: {
  episode: LesionEpisode;
  isPatient: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false),
    [addLocation, setAddLocation] = useState(false),
    [bodyPart, setBodyPart] = useState(""),
    [photoLocation, setPhotoLocation] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const detail = useResource<LesionEpisode>(
    open ? `/lesion-episodes/${episode.id}` : null,
  );
  async function createLocation(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("/lesion-locations", {
        episode_id: episode.id,
        body_part: bodyPart,
      });
      setAddLocation(false);
      setBodyPart("");
      detail.reload();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="episode">
      <button className="episode-header" onClick={() => setOpen(!open)}>
        <span className="episode-icon">
          <Activity size={20} />
        </span>
        <div>
          <strong>
            {episode.name || "Đợt tổn thương"} ·{" "}
            {date(episode.started_at || episode.created_at)}
          </strong>
          <small>
            {episode.context_tags?.join(" · ") || "Chưa ghi nhận bối cảnh"}
          </small>
        </div>
        <ChevronDown size={18} className={open ? "rotated" : ""} />
      </button>
      {open && (
        <div className="episode-body">
          <ErrorBox message={error || detail.error} />
          {detail.loading ? (
            <Loading />
          ) : (
            <>
              {detail.data?.notes && (
                <p className="muted">{detail.data.notes}</p>
              )}
              {detail.data?.medications && (
                <p>
                  Thuốc đã dùng: <strong>{detail.data.medications}</strong>
                </p>
              )}
              {detail.data?.locations?.map((location) => (
                <div className="lesion-location" key={location.id}>
                  <div className="treatment-heading">
                    <strong>{location.body_part}</strong>
                    {isPatient && (
                      <Button
                        variant="secondary"
                        onClick={() => setPhotoLocation(location.id)}
                      >
                        <ImagePlus size={15} />
                        Thêm ảnh mốc
                      </Button>
                    )}
                  </div>
                  <div className="lesion-photos">
                    {location.photos?.map((photo) => (
                      <div key={photo.id} className="lesion-photo">
                        <MediaImage
                          id={photo.attachment_id || photo.media_id || ""}
                        />
                        <div>
                          <span
                            className={`badge ${photo.milestone === "normal" || photo.stage === "normal" ? "completed" : "pending"}`}
                          >
                            {{
                              start: "Khởi phát",
                              peak: "Đỉnh điểm",
                              normal: "Hồi phục",
                            }[photo.milestone || photo.stage || ""] ||
                              photo.milestone}
                          </span>
                          <small>
                            Ngứa {photo.itch_score} · Đau {photo.pain_score} ·
                            Sẩn {photo.hives_count}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                  {!location.photos?.length && (
                    <p className="muted">Chưa có ảnh tiến triển.</p>
                  )}
                </div>
              ))}
              {isPatient &&
                (addLocation ? (
                  <form className="inline-form" onSubmit={createLocation}>
                    <Field label="Vị trí tổn thương" required>
                      <select
                        required
                        value={bodyPart}
                        onChange={(e) => setBodyPart(e.target.value)}
                      >
                        <option value="">Chọn vị trí</option>
                        {[
                          "Mặt",
                          "Cổ",
                          "Ngực",
                          "Bụng",
                          "Lưng",
                          "Tay trái",
                          "Tay phải",
                          "Chân trái",
                          "Chân phải",
                          "Toàn thân",
                        ].map((x) => (
                          <option value={x} key={x}>
                            {x}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div className="actions">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setAddLocation(false)}
                      >
                        Hủy
                      </Button>
                      <Button type="submit" busy={busy}>
                        Lưu vị trí
                      </Button>
                    </div>
                  </form>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => setAddLocation(true)}
                  >
                    <Plus size={15} />
                    Thêm vị trí tổn thương
                  </Button>
                ))}
            </>
          )}
        </div>
      )}
      {photoLocation && (
        <PhotoModal
          locationId={photoLocation}
          onClose={() => setPhotoLocation(null)}
          onSaved={() => {
            setPhotoLocation(null);
            detail.reload();
          }}
        />
      )}
    </article>
  );
}
function PhotoModal({
  locationId,
  onClose,
  onSaved,
}: {
  locationId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [milestone, setMilestone] = useState("start"),
    [itch, setItch] = useState(0),
    [pain, setPain] = useState(0),
    [burn, setBurn] = useState(0),
    [hives, setHives] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const media = rows(await upload([file]))[0];
      if (!media?.id) throw new Error("Không nhận được mã ảnh.");
      await post("/lesion-photos", {
        location_id: locationId,
        attachment_id: media.id,
        milestone,
        itch_score: itch,
        pain_score: pain,
        burn_score: burn,
        hives_count: hives,
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Thêm ảnh tiến triển tổn thương" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <Field label="Ảnh vùng tổn thương" required>
            <input
              type="file"
              accept="image/*"
              required
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </Field>
          <Field label="Mốc tiến triển">
            <select
              value={milestone}
              onChange={(e) => setMilestone(e.target.value)}
            >
              <option value="start">Khởi phát</option>
              <option value="peak">Đỉnh điểm</option>
              <option value="normal">Hồi phục</option>
            </select>
          </Field>
          <div className="form-grid">
            {[
              { label: "Điểm ngứa (0–10)", value: itch, change: setItch },
              { label: "Điểm đau (0–10)", value: pain, change: setPain },
              { label: "Điểm rát (0–10)", value: burn, change: setBurn },
            ].map((f) => (
              <Field key={f.label} label={f.label}>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={f.value}
                  onChange={(e) => f.change(Number(e.target.value))}
                />
              </Field>
            ))}
            <Field label="Số lượng sẩn phù">
              <input
                type="number"
                min={0}
                value={hives}
                onChange={(e) => setHives(Number(e.target.value))}
              />
            </Field>
          </div>
          <ErrorBox message={error} />
        </div>
        <div className="modal-footer">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" busy={busy}>
            Lưu ảnh theo dõi
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function NotificationsPage({ onChange }: { onChange: () => void }) {
  const notifications = useResource<Notification[]>("/notifications"),
    settings = useResource<Record<string, boolean | string>>(
      "/notifications/settings",
    ),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  async function read(id: string) {
    try {
      await put(`/notifications/${id}/read`, {});
      notifications.reload();
      onChange();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function erase(id: string) {
    try {
      await remove(`/notifications/${id}`);
      notifications.reload();
      onChange();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function setting(key: string, value: boolean | string) {
    try {
      await put("/notifications/settings", { [key]: value });
      settings.reload();
      setSuccess("Đã cập nhật cài đặt thông báo.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="CẬP NHẬT CHĂM SÓC"
        title="Thông báo"
        description="Theo dõi các cập nhật hồ sơ, đơn thuốc và kết quả xét nghiệm."
      />
      <ErrorBox message={error} />
      <Success message={success} />
      <div className="notifications-layout">
        <Card
          title="Hộp thông báo"
          description={`${rows(notifications.data).filter((n) => n.is_read === false || n.is_read === "0").length} thông báo chưa đọc`}
        >
          <ErrorBox message={notifications.error} />
          {notifications.loading ? (
            <Loading />
          ) : !rows(notifications.data).length ? (
            <Empty
              title="Bạn đã cập nhật mọi thứ"
              text="Thông báo mới về khám và điều trị sẽ xuất hiện tại đây."
            />
          ) : (
            <div className="notification-list">
              {rows(notifications.data).map((n) => {
                const unread = n.is_read === false || n.is_read === "0";
                return (
                  <article
                    className={`notification-item ${unread ? "unread" : ""}`}
                    key={n.id}
                  >
                    <div className="notification-icon">
                      <BellRing size={21} />
                    </div>
                    <div>
                      <strong>{n.title}</strong>
                      <p>{n.body || n.content || n.message}</p>
                      <small>{date(n.created_at)}</small>
                    </div>
                    <div className="actions">
                      {unread && (
                        <button
                          className="icon-button"
                          aria-label="Đánh dấu đã đọc"
                          onClick={() => void read(n.id)}
                        >
                          <CheckCheck size={18} />
                        </button>
                      )}
                      <button
                        className="icon-button danger-text"
                        aria-label="Xóa thông báo"
                        onClick={() => void erase(n.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Card>
        <Card
          title="Cài đặt thông báo"
          description="Tùy chỉnh nhắc nhở chăm sóc"
        >
          <ErrorBox message={settings.error} />
          {settings.loading ? (
            <Loading />
          ) : (
            <div className="notification-settings">
              {[
                {
                  key: "push_enabled",
                  title: "Thông báo đẩy",
                  text: "Nhận cập nhật trên thiết bị",
                },
                {
                  key: "sound_enabled",
                  title: "Âm thanh",
                  text: "Âm thanh khi có thông báo",
                },
                {
                  key: "uas7_reminder",
                  title: "Nhắc ghi điểm UAS7",
                  text: "Ghi nhận điểm hằng ngày",
                },
                {
                  key: "medication_reminder",
                  title: "Nhắc uống thuốc",
                  text: "Duy trì lịch điều trị",
                },
              ].map((s) => (
                <label className="toggle-row" key={s.key}>
                  <div>
                    <strong>{s.title}</strong>
                    <small>{s.text}</small>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!settings.data?.[s.key]}
                    onChange={(e) => void setting(s.key, e.target.checked)}
                  />
                </label>
              ))}
              <Field label="Giờ nhắc hằng ngày">
                <input
                  type="time"
                  value={String(settings.data?.reminder_time || "20:00")}
                  onChange={(e) =>
                    void setting("reminder_time", e.target.value)
                  }
                />
              </Field>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
