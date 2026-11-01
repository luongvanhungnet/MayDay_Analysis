import { confirmAction } from "./confirmation";
import { useEffect, useState, type FormEvent } from "react";
import { FileImage } from "lucide-react";
import { api, apiBlob, patch, post, remove, type Session } from "./api";
import {
  Button,
  Empty,
  ErrorBox,
  Field,
  Loading,
  Modal,
  Pagination,
  Success,
  usePagedResource,
  useResource,
} from "./ui";
import { fields, type Row } from "./care-model";
import { ActionForm, Details, ReferenceSelect, Rows } from "./care-ui";
const { f } = fields;

export function ImagePreview({
  fileId,
  name,
  close,
}: {
  fileId: string;
  name: string;
  close: () => void;
}) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    let objectUrl = "";
    void apiBlob(`/image-attachments/${fileId}/content`, abort.signal)
      .then((blob) => {
        if (!abort.signal.aborted) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => {
      abort.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);
  return (
    <Modal title={name} onClose={close} wide>
      <div className="modal-body">
        <ErrorBox message={error} />
        {url ? (
          <>
            <img className="care-image" src={url} alt={name} />
            <a className="button secondary" href={url} download={name}>
              Tải ảnh xuống
            </a>
          </>
        ) : (
          !error && <Loading />
        )}
      </div>
    </Modal>
  );
}
export function UploadImage({
  close,
  saved,
}: {
  close: () => void;
  saved: () => void;
}) {
  const [record, setRecord] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [description, setDescription] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file || !record) return;
    setError("");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 8 * 1024 * 1024
    ) {
      setError("Chọn ảnh JPEG, PNG hoặc WebP, tối đa 8 MiB.");
      return;
    }
    setBusy(true);
    try {
      const data = new FormData();
      data.append("image", file);
      data.append("medical_record_id", record);
      if (description) data.append("description", description);
      await api("/image-attachments/upload", { method: "POST", body: data });
      saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Tải ảnh tổn thương"
      onClose={() => {
        if (!busy) close();
      }}
    >
      <form onSubmit={submit}>
        <div className="modal-body">
          <Field label="Hồ sơ bệnh án" required>
            <ReferenceSelect
              reference="records"
              value={record}
              onChange={setRecord}
              required
              labelText="hồ sơ bệnh án"
            />
          </Field>
          <Field label="Ảnh (JPEG, PNG, WebP · tối đa 8 MiB)" required>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </Field>
          <Field label="Mô tả">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <ErrorBox message={error} />
        </div>
        <div className="modal-footer">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={close}
          >
            Hủy
          </Button>
          <Button type="submit" busy={busy}>
            Tải ảnh lên
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function MediaPage({ session }: { session: Session }) {
  const [userId, setUserId] = useState(session.user.id),
    [page, setPage] = useState(1),
    [upload, setUpload] = useState(false),
    [preview, setPreview] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const list = usePagedResource<Row>(
    userId ? `/image-attachments/user/${userId}?page=${page}` : null,
  );
  async function erase(row: Row) {
    if (
      !(await confirmAction(
        "Xóa ảnh này? Ảnh đang được dùng trong theo dõi tổn thương sẽ không thể xóa.",
      ))
    )
      return;
    setError("");
    try {
      const result = (await remove(`/image-attachments/${row.id}`)) as {
        storage_cleanup_pending?: boolean;
      };
      setSuccess(
        result?.storage_cleanup_pending
          ? "Đã xóa thông tin ảnh; nội dung tệp đang chờ dọn dẹp."
          : "Đã xóa ảnh.",
      );
      list.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="native-content">
      <div className="page-title">
        <div>
          <span className="eyebrow">ẢNH & TỆP ĐÍNH KÈM</span>
          <h1>Kho ảnh của tôi</h1>
          <p className="muted">
            Ảnh được gắn với hồ sơ khám và chỉ truy cập qua tài khoản có quyền.
          </p>
        </div>
        <Button onClick={() => setUpload(true)}>Tải ảnh lên</Button>
      </div>
      {session.user.role === "admin" && (
        <div className="card care-panel">
          <Field label="Xem kho ảnh theo tài khoản">
            <ReferenceSelect
              reference="users"
              value={userId}
              onChange={(v) => {
                setUserId(v);
                setPage(1);
              }}
              labelText="tài khoản"
            />
          </Field>
        </div>
      )}
      <Success message={success} />
      <ErrorBox message={error || list.error} />
      <div className="card">
        {list.loading ? (
          <Loading />
        ) : list.data?.length ? (
          <div className="care-gallery">
            {list.data.map((row) => (
              <article key={String(row.id)}>
                <div className="care-file-icon">
                  <FileImage size={42} />
                </div>
                <h3>{String(row.file_name)}</h3>
                <p className="muted">
                  Hồ sơ #{String(row.medical_record_id)} ·{" "}
                  {Math.ceil(Number(row.size) / 1024)} KB
                </p>
                <div className="care-row-actions">
                  <button className="text-link" onClick={() => setPreview(row)}>
                    Xem / tải ảnh
                  </button>
                  <button
                    className="text-link danger-text"
                    onClick={() => void erase(row)}
                  >
                    Xóa
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title="Chưa có ảnh"
            text="Tải ảnh lên để lưu vào hồ sơ và sử dụng khi ghi nhận tổn thương."
          />
        )}
        <Pagination meta={list.meta} page={page} onChange={setPage} />
      </div>
      {upload && (
        <UploadImage
          close={() => setUpload(false)}
          saved={() => {
            setUpload(false);
            setUserId(session.user.id);
            setSuccess("Đã tải ảnh lên.");
            list.reload();
          }}
        />
      )}
      {preview && (
        <ImagePreview
          fileId={String(preview.id)}
          name={String(preview.file_name)}
          close={() => setPreview(null)}
        />
      )}
    </section>
  );
}
export function LesionsPage({ session }: { session: Session }) {
  const patient = session.user.role === "benh_nhan",
    [patientId, setPatientId] = useState(
      patient ? (session.user.person_id ?? "") : "",
    ),
    [page, setPage] = useState(1),
    [creating, setCreating] = useState(false),
    [selected, setSelected] = useState<Row | null>(null),
    [edit, setEdit] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const path = patient
    ? `/lesion-episodes/my?page=${page}`
    : patientId
      ? `/data/dottonthuongda?page=${page}&filter=${encodeURIComponent(JSON.stringify({ ma_benh_nhan: patientId }))}`
      : null;
  const list = usePagedResource<Row>(path);
  const rows = patient
    ? list.data
    : list.data?.map((r) => ({
        id: r.ma_dot_ton_thuong_da,
        patient_id: r.ma_benh_nhan,
        medical_record_id: r.ma_ho_so_man,
        name: r.ten_dot_ton_thuong_da,
        onset_at: r.thoi_diem_xuat_hien,
        description: r.chi_tiet_dot_ton_thuong,
      }));
  const canWrite = ["admin", "bac_si", "benh_nhan"].includes(session.user.role);
  const inputs = [
    f("name", "Tên đợt tổn thương", { required: true }),
    f("medical_record_id", "Hồ sơ mạn liên quan", {
      reference: `records:${patientId}`,
    }),
    f("onset_at", "Thời điểm xuất hiện", { type: "datetime-local" }),
    f("description", "Diễn biến", { type: "textarea" }),
  ];
  async function open(row: Row) {
    setError("");
    try {
      setSelected(await api<Row>(`/lesion-episodes/${row.id}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function erase(row: Row) {
    if (
      !(await confirmAction(
        "Xóa đợt tổn thương? Các vị trí và ảnh liên quan phải được xử lý trước.",
      ))
    )
      return;
    setError("");
    try {
      await remove(`/lesion-episodes/${row.id}`);
      setSuccess("Đã xóa đợt tổn thương.");
      list.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="native-content">
      <div className="page-title">
        <div>
          <span className="eyebrow">THEO DÕI TIẾN TRIỂN</span>
          <h1>Tổn thương da</h1>
          <p className="muted">
            Ghi nhận từng đợt, vị trí và ảnh theo mốc tiến triển.
          </p>
        </div>
        {canWrite && (
          <Button disabled={!patientId} onClick={() => setCreating(true)}>
            Tạo đợt tổn thương
          </Button>
        )}
      </div>
      {!patient && (
        <div className="card care-panel">
          <Field label="Bệnh nhân">
            <ReferenceSelect
              reference="patients"
              value={patientId}
              onChange={(v) => {
                setPatientId(v);
                setPage(1);
              }}
              labelText="bệnh nhân"
            />
          </Field>
        </div>
      )}
      <Success message={success} />
      <ErrorBox message={error || list.error} />
      <div className="card">
        {!patientId ? (
          <Empty title="Chọn bệnh nhân để xem tổn thương" />
        ) : list.loading ? (
          <Loading />
        ) : rows?.length ? (
          <Rows
            rows={rows}
            columns={["name", "medical_record_id", "onset_at"]}
            actions={(r) => (
              <>
                <button className="text-link" onClick={() => void open(r)}>
                  Vị trí & ảnh
                </button>
                {canWrite && (
                  <>
                    <button className="text-link" onClick={() => setEdit(r)}>
                      Sửa
                    </button>
                    <button
                      className="text-link danger-text"
                      onClick={() => void erase(r)}
                    >
                      Xóa
                    </button>
                  </>
                )}
              </>
            )}
          />
        ) : (
          <Empty title="Chưa có đợt tổn thương" />
        )}
        <Pagination meta={list.meta} page={page} onChange={setPage} />
      </div>
      {creating && (
        <ActionForm
          title="Tạo đợt tổn thương"
          fields={inputs}
          close={() => setCreating(false)}
          onSubmit={(d) =>
            post("/lesion-episodes", { ...d, patient_id: patientId })
          }
          saved={() => {
            setCreating(false);
            setSuccess("Đã tạo đợt tổn thương.");
            list.reload();
          }}
        />
      )}
      {edit && (
        <ActionForm
          title="Cập nhật đợt tổn thương"
          fields={inputs.filter((f) => f.name !== "medical_record_id")}
          original={edit}
          close={() => setEdit(null)}
          onSubmit={(d) => patch(`/lesion-episodes/${edit.id}`, d)}
          saved={() => {
            setEdit(null);
            setSuccess("Đã cập nhật đợt tổn thương.");
            list.reload();
          }}
        />
      )}
      {selected && (
        <EpisodeDetail
          episode={selected}
          session={session}
          canWrite={canWrite}
          close={() => setSelected(null)}
        />
      )}
    </section>
  );
}
function EpisodeDetail({
  episode,
  session,
  canWrite,
  close,
}: {
  episode: Row;
  session: Session;
  canWrite: boolean;
  close: () => void;
}) {
  const [page, setPage] = useState(1);
  const list = usePagedResource<Row>(
      `/lesion-locations/episode/${episode.id}?page=${page}`,
    ),
    [editing, setEditing] = useState<Row | null | undefined>(),
    [location, setLocation] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  async function erase(row: Row) {
    if (
      !(await confirmAction(
        "Xóa vị trí này? Vị trí đang có ảnh sẽ không thể xóa.",
      ))
    )
      return;
    setError("");
    try {
      await remove(`/lesion-locations/${row.id}`);
      list.reload();
      if (location?.id === row.id) setLocation(null);
      setSuccess("Đã xóa vị trí.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const inputs = [
    f("body_location", "Vị trí cơ thể", { required: true }),
    f("onset_at", "Thời điểm xuất hiện", { type: "datetime-local" }),
  ];
  return (
    <>
      <Modal
        title={String(episode.name ?? `Đợt tổn thương #${episode.id}`)}
        onClose={close}
        wide
      >
        <div className="modal-body">
          <Details data={episode} />
          <div className="care-section-heading">
            <h3>Vị trí tổn thương</h3>
            {canWrite && (
              <Button onClick={() => setEditing(null)}>Thêm vị trí</Button>
            )}
          </div>
          <Success message={success} />
          <ErrorBox message={error || list.error} />
          {list.loading ? (
            <Loading />
          ) : list.data?.length ? (
            <Rows
              rows={list.data}
              columns={["body_location", "onset_at"]}
              actions={(r) => (
                <>
                  <button className="text-link" onClick={() => setLocation(r)}>
                    Ảnh tiến triển
                  </button>
                  {canWrite && (
                    <>
                      <button
                        className="text-link"
                        onClick={() => setEditing(r)}
                      >
                        Sửa
                      </button>
                      <button
                        className="text-link danger-text"
                        onClick={() => void erase(r)}
                      >
                        Xóa
                      </button>
                    </>
                  )}
                </>
              )}
            />
          ) : (
            <Empty title="Chưa ghi nhận vị trí" />
          )}
          <Pagination meta={list.meta} page={page} onChange={setPage} />
          {location && (
            <PhotoPanel
              key={String(location.id)}
              location={location}
              episode={episode}
              session={session}
              canWrite={canWrite}
            />
          )}
        </div>
      </Modal>
      {editing !== undefined && (
        <ActionForm
          title={editing ? "Sửa vị trí tổn thương" : "Thêm vị trí tổn thương"}
          fields={inputs}
          original={editing ?? undefined}
          close={() => setEditing(undefined)}
          onSubmit={(d) =>
            editing
              ? patch(`/lesion-locations/${editing.id}`, d)
              : post("/lesion-locations", { ...d, episode_id: episode.id })
          }
          saved={() => {
            setEditing(undefined);
            setSuccess("Đã lưu vị trí tổn thương.");
            list.reload();
          }}
        />
      )}
    </>
  );
}
function PhotoPanel({
  location,
  episode,
  session,
  canWrite,
}: {
  location: Row;
  episode: Row;
  session: Session;
  canWrite: boolean;
}) {
  const [page, setPage] = useState(1);
  const list = usePagedResource<Row>(
      `/lesion-photos/location/${location.id}?page=${page}`,
    ),
    [create, setCreate] = useState(false),
    [milestone, setMilestone] = useState<Row | null>(null),
    [preview, setPreview] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  async function erase(row: Row) {
    if (
      !(await confirmAction(
        "Xóa bản ghi ảnh tiến triển này? Ảnh gốc trong kho vẫn được giữ.",
      ))
    )
      return;
    setError("");
    try {
      await remove(`/lesion-photos/${row.id}`);
      list.reload();
      setSuccess("Đã xóa bản ghi ảnh tiến triển.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const milestones = ["start", "peak", "normal"];
  return (
    <div className="care-photo-panel">
      <div className="care-section-heading">
        <h3>Ảnh · {String(location.body_location)}</h3>
        {canWrite && (
          <Button onClick={() => setCreate(true)}>Ghi ảnh tiến triển</Button>
        )}
      </div>
      <p className="muted">
        Mốc: start (bắt đầu), peak (đỉnh), normal (trở về bình thường). Ảnh cần
        được tải lên kho ảnh của bạn trước.
      </p>
      <Success message={success} />
      <ErrorBox message={error || list.error} />
      {list.loading ? (
        <Loading />
      ) : list.data?.length ? (
        <Rows
          rows={list.data}
          columns={[
            "taken_at",
            "milestone",
            "itch_score",
            "pain_score",
            "wheal_count",
          ]}
          actions={(r) => (
            <>
              <button className="text-link" onClick={() => setPreview(r)}>
                Xem ảnh
              </button>
              {canWrite && (
                <>
                  <button className="text-link" onClick={() => setMilestone(r)}>
                    Đổi mốc
                  </button>
                  <button
                    className="text-link danger-text"
                    onClick={() => void erase(r)}
                  >
                    Xóa
                  </button>
                </>
              )}
            </>
          )}
        />
      ) : (
        <Empty title="Chưa có ảnh ở vị trí này" />
      )}
      <Pagination meta={list.meta} page={page} onChange={setPage} />
      {create && (
        <ActionForm
          title="Ghi ảnh tiến triển"
          fields={[
            f("attachment_id", "Ảnh trong kho của bạn", {
              reference: `files:${session.user.id}`,
              required: true,
            }),
            f("taken_at", "Thời điểm chụp", {
              type: "datetime-local",
              required: true,
            }),
            f("milestone", "Mốc tiến triển", {
              type: "select",
              options: milestones,
              required: true,
            }),
            ...["itch_score", "pain_score", "burning_score"].map((name, i) =>
              f(
                name,
                ["Điểm ngứa (0–10)", "Điểm đau (0–10)", "Điểm bỏng rát (0–10)"][
                  i
                ],
                { type: "number", min: 0, max: 10 },
              ),
            ),
            f("wheal_count", "Số sẩn phù", { type: "number", min: 0 }),
          ]}
          close={() => setCreate(false)}
          onSubmit={(d) =>
            post("/lesion-photos", {
              ...d,
              episode_id: episode.id,
              location_id: location.id,
            })
          }
          saved={() => {
            setCreate(false);
            setSuccess("Đã lưu ảnh tiến triển.");
            list.reload();
          }}
          note="Chọn ảnh gắn cùng bệnh án của đợt tổn thương này."
        />
      )}
      {milestone && (
        <ActionForm
          title="Đổi mốc tiến triển"
          fields={[
            f("milestone", "Mốc tiến triển", {
              type: "select",
              options: milestones,
              required: true,
            }),
          ]}
          original={milestone}
          close={() => setMilestone(null)}
          onSubmit={(d) =>
            patch(`/lesion-photos/${milestone.id}/milestone`, {
              milestone: d.milestone ?? milestone.milestone,
            })
          }
          saved={() => {
            setMilestone(null);
            list.reload();
          }}
        />
      )}
      {preview && (
        <ImagePreview
          fileId={String(preview.attachment_id)}
          name={`Ảnh tiến triển #${preview.id}`}
          close={() => setPreview(null)}
        />
      )}
    </div>
  );
}
