import { confirmAction } from "./confirmation";
import { useEffect, useState, type FormEvent } from "react";
import { api, post, put, type Session } from "./api";
import {
  Badge,
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
import { fields, recordActions, type Row } from "./care-model";
import {
  ActionForm,
  Details,
  ReferenceSelect,
  Rows,
  useSearch,
} from "./care-ui";
const { f } = fields;

export function RecordsPage({ session }: { session: Session }) {
  const [page, setPage] = useState(1),
    [status, setStatus] = useState(""),
    [creating, setCreating] = useState(false),
    [selected, setSelected] = useState<Row | null>(null),
    [success, setSuccess] = useState("");
  const list = usePagedResource<Row>(
    `/medical_records/all?page=${page}${status ? `&status=${status}` : ""}`,
  );
  const inputs = [
    ...(session.user.role === "benh_nhan"
      ? []
      : [
          f("patient_id", "Bệnh nhân", {
            reference: "patients",
            required: true,
          }),
        ]),
    f("record_type", "Loại bệnh án", {
      type: "select",
      options: ["CAP", "MAN"],
      required: true,
    }),
    f("initial_diagnosis", "Chẩn đoán ban đầu", { type: "textarea" }),
  ];
  return (
    <section className="native-content">
      <div className="page-title">
        <div>
          <span className="eyebrow">KHÁM & ĐIỀU TRỊ</span>
          <h1>Hồ sơ bệnh án</h1>
          <p className="muted">
            Theo dõi từ tiếp nhận đến hoàn thành khám bệnh.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>Tạo bệnh án</Button>
      </div>
      <Success message={success} />
      <ErrorBox message={list.error} />
      <div className="card">
        <div className="native-toolbar">
          <Field label="Trạng thái">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="pending">Chờ tiếp nhận</option>
              <option value="in_progress">Đang khám</option>
              <option value="completed">Hoàn thành</option>
              <option value="draft">Bản nháp</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </Field>
          <span className="muted">{list.meta?.total ?? "—"} hồ sơ</span>
        </div>
        {list.loading ? (
          <Loading />
        ) : list.data?.length ? (
          <Rows
            rows={list.data}
            columns={[
              "id",
              "patient_id",
              "record_type",
              "initial_diagnosis",
              "status",
            ]}
            actions={(r) => (
              <button className="text-link" onClick={() => setSelected(r)}>
                Mở hồ sơ
              </button>
            )}
          />
        ) : (
          <Empty title="Chưa có hồ sơ phù hợp" />
        )}
        <Pagination meta={list.meta} page={page} onChange={setPage} />
      </div>
      {creating && (
        <ActionForm
          title="Tạo hồ sơ bệnh án"
          fields={inputs}
          close={() => setCreating(false)}
          onSubmit={(d) => post("/medical_records", d)}
          saved={() => {
            setCreating(false);
            setSuccess("Đã tạo hồ sơ, chờ bác sĩ tiếp nhận.");
            list.reload();
          }}
        />
      )}
      {selected && (
        <RecordDetail
          key={String(selected.id)}
          record={selected}
          session={session}
          close={() => setSelected(null)}
          changed={() => {
            list.reload();
          }}
        />
      )}
    </section>
  );
}
function RecordDetail({
  record,
  session,
  close,
  changed,
}: {
  record: Row;
  session: Session;
  close: () => void;
  changed: () => void;
}) {
  const detail = useResource<Row>(`/medical_records/${record.id}`),
    summary = useResource<Row>(`/medical_records/${record.id}/summary`),
    labs = useResource<Row[]>(`/lab-results/${record.id}`),
    history = usePagedResource<Row>(
      `/medical_records/patients/${record.patient_id}/history`,
    );
  const [action, setAction] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const actions = recordActions(session.user, summary.data ?? record);
  function reload() {
    summary.reload();
    detail.reload();
    changed();
  }
  async function accept() {
    if (!(await confirmAction("Tiếp nhận hồ sơ này và bắt đầu phiên khám?")))
      return;
    setBusy(true);
    setError("");
    try {
      await post(`/medical_records/${record.id}/accept`, {});
      setSuccess("Bạn đã tiếp nhận hồ sơ.");
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Modal title={`Hồ sơ #${record.id}`} onClose={close} wide>
        <div className="modal-body">
          <div className="care-record-heading">
            <Badge status={String(summary.data?.status ?? record.status)} />
            <div className="native-actions">
              {actions.includes("accept") && (
                <Button busy={busy} onClick={() => void accept()}>
                  Tiếp nhận khám
                </Button>
              )}
              {actions.includes("prescribe") && (
                <Button onClick={() => setAction("prescribe")}>
                  Kê đơn thuốc
                </Button>
              )}
              {actions.includes("complete") && (
                <Button
                  variant="secondary"
                  onClick={() => setAction("complete")}
                >
                  Chốt bệnh án
                </Button>
              )}
            </div>
          </div>
          <Success message={success} />
          <ErrorBox message={error || detail.error || summary.error} />
          {detail.loading ? (
            <Loading />
          ) : (
            detail.data && <Details data={detail.data} />
          )}
          <h3>Phiên khám mới nhất</h3>
          {summary.data?.latest_visit ? (
            <Details data={summary.data.latest_visit as Row} />
          ) : (
            <p className="muted">Hồ sơ chưa được bác sĩ tiếp nhận.</p>
          )}
          <h3>Kết quả cận lâm sàng</h3>
          <ErrorBox message={labs.error} />
          {labs.loading ? (
            <Loading />
          ) : labs.data?.length ? (
            labs.data.map((r, i) => (
              <details key={i}>
                <summary>Kết quả #{String(r.ma_ket_qua_can_lam_sang)}</summary>
                <Details data={r} />
              </details>
            ))
          ) : (
            <p className="muted">Chưa có kết quả xét nghiệm.</p>
          )}
          <h3>Lịch sử khám của bệnh nhân</h3>
          <ErrorBox message={history.error} />
          {history.loading ? (
            <Loading />
          ) : history.data?.length ? (
            <Rows
              rows={history.data}
              columns={["id", "record_type", "status"]}
            />
          ) : (
            <p className="muted">Chưa có lịch sử khám.</p>
          )}
        </div>
      </Modal>
      {action === "complete" && (
        <ActionForm
          title="Chốt bệnh án"
          fields={[
            f("instructions", "Dặn dò của bác sĩ", {
              type: "textarea",
              required: true,
            }),
          ]}
          note="Sau khi chốt, hồ sơ chuyển sang trạng thái hoàn thành và kết thúc thao tác kê đơn."
          close={() => setAction("")}
          onSubmit={(d) => put(`/medical_records/${record.id}`, d)}
          saved={() => {
            setAction("");
            setSuccess("Đã chốt bệnh án.");
            reload();
          }}
        />
      )}
      {action === "prescribe" && (
        <Prescription
          recordId={String(record.id)}
          close={() => setAction("")}
          saved={() => {
            setAction("");
            setSuccess("Đã lưu đơn thuốc.");
            reload();
          }}
        />
      )}
    </>
  );
}
function Prescription({
  recordId,
  close,
  saved,
}: {
  recordId: string;
  close: () => void;
  saved: () => void;
}) {
  const [medicines, setMedicines] = useState([
      { name: "", dosage: "", duration: "" },
    ]),
    [notes, setNotes] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("/prescriptions", {
        medical_record_id: recordId,
        notes,
        medicines,
      });
      saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={`Kê đơn · Hồ sơ #${recordId}`} onClose={close} wide>
      <form onSubmit={submit}>
        <div className="modal-body">
          <p className="care-note">
            Nhập tên thuốc, liều dùng và thời gian dùng cho từng thuốc trong
            đơn.
          </p>
          {medicines.map((m, i) => (
            <fieldset className="care-medicine" key={i}>
              <legend>Thuốc {i + 1}</legend>
              <div className="form-grid">
                {(["name", "dosage", "duration"] as const).map((k, j) => (
                  <Field
                    key={k}
                    label={["Tên thuốc", "Liều dùng", "Thời gian dùng"][j]}
                    required
                  >
                    <input
                      required
                      maxLength={k === "name" ? 255 : 100}
                      value={m[k]}
                      onChange={(e) =>
                        setMedicines((ms) =>
                          ms.map((v, n) =>
                            n === i ? { ...v, [k]: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </Field>
                ))}
              </div>
              {medicines.length > 1 && (
                <button
                  type="button"
                  className="text-link danger-text"
                  onClick={() =>
                    setMedicines((ms) => ms.filter((_, n) => i !== n))
                  }
                >
                  Bỏ thuốc này
                </button>
              )}
            </fieldset>
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={medicines.length >= 100}
            onClick={() =>
              setMedicines((ms) => [
                ...ms,
                { name: "", dosage: "", duration: "" },
              ])
            }
          >
            Thêm thuốc
          </Button>
          <Field label="Ghi chú điều trị">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
          <ErrorBox message={error} />
        </div>
        <div className="modal-footer">
          <Button type="button" variant="secondary" onClick={close}>
            Hủy
          </Button>
          <Button type="submit" busy={busy}>
            Lưu đơn thuốc
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function PatientsPage() {
  const { search, setSearch, query } = useSearch(),
    [page, setPage] = useState(1),
    [creating, setCreating] = useState(false),
    [selected, setSelected] = useState<Row | null>(null),
    [success, setSuccess] = useState("");
  useEffect(() => setPage(1), [query]);
  const data = useResource<Row[]>(
    `/doctor/patients/search?search=${encodeURIComponent(query)}&page=${page}&limit=25`,
  );
  return (
    <section className="native-content">
      <div className="page-title">
        <div>
          <span className="eyebrow">TIẾP NHẬN</span>
          <h1>Bệnh nhân</h1>
          <p className="muted">Tìm hồ sơ trước khi tiếp nhận bệnh nhân mới.</p>
        </div>
        <Button onClick={() => setCreating(true)}>Tiếp nhận bệnh nhân</Button>
      </div>
      <Success message={success} />
      <ErrorBox message={data.error} />
      <div className="card">
        <div className="native-toolbar">
          <input
            placeholder="Tìm họ tên hoặc số điện thoại…"
            aria-label="Tìm bệnh nhân"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {data.loading ? (
          <Loading />
        ) : data.data?.length ? (
          <Rows
            rows={data.data}
            columns={["id", "full_name", "phone", "gender"]}
            actions={(r) => (
              <button className="text-link" onClick={() => setSelected(r)}>
                Thông tin bệnh nhân
              </button>
            )}
          />
        ) : (
          <Empty />
        )}
        <div className="pagination">
          <Button
            variant="secondary"
            disabled={page === 1 || data.loading}
            onClick={() => setPage((p) => p - 1)}
          >
            Trang trước
          </Button>
          <span>Trang {page}</span>
          <Button
            variant="secondary"
            disabled={data.loading || (data.data?.length ?? 0) < 25}
            onClick={() => setPage((p) => p + 1)}
          >
            Trang sau
          </Button>
        </div>
      </div>
      {creating && (
        <ActionForm
          title="Tiếp nhận bệnh nhân"
          fields={[
            f("full_name", "Họ và tên", { required: true }),
            f("phone", "Số điện thoại (10 chữ số)", { required: true }),
            f("date_of_birth", "Ngày sinh", { type: "date" }),
            f("gender", "Giới tính", {
              type: "select",
              options: ["Nam", "Nu"],
            }),
          ]}
          close={() => setCreating(false)}
          onSubmit={(person) =>
            post("/doctor/patients", { person, patient: {} })
          }
          saved={() => {
            setCreating(false);
            setSuccess("Đã tiếp nhận bệnh nhân.");
            data.reload();
          }}
          note="Hồ sơ tiếp nhận chưa bao gồm tài khoản đăng nhập. Bệnh nhân có thể đăng ký tài khoản hoặc nhờ quản trị viên cấp tài khoản."
        />
      )}
      {selected && (
        <Modal
          title={String(selected.full_name)}
          onClose={() => setSelected(null)}
          wide
        >
          <div className="modal-body">
            <Details data={selected} />
          </div>
        </Modal>
      )}
    </section>
  );
}
export function UasPage({ session }: { session: Session }) {
  const patient = session.user.role === "benh_nhan",
    [patientId, setPatientId] = useState(
      patient ? (session.user.person_id ?? "") : "",
    ),
    [creating, setCreating] = useState(false),
    [success, setSuccess] = useState(""),
    [page, setPage] = useState(1);
  const eligibility = useResource<{
    eligible: boolean;
    medical_record_ids: string[];
  }>(patient ? "/uas7-scores/eligibility" : null);
  const list = usePagedResource<Row>(
    patientId ? `/uas7-scores/patient/${patientId}?page=${page}` : null,
  );
  return (
    <section className="native-content">
      <div className="page-title">
        <div>
          <span className="eyebrow">THEO DÕI HẰNG NGÀY</span>
          <h1>Nhật ký UAS</h1>
          <p className="muted">
            Ghi điểm sẩn phù và điểm ngứa trong ngày, mỗi điểm từ 0 đến 3.
          </p>
        </div>
        {patient && (
          <Button
            disabled={eligibility.loading || !eligibility.data?.eligible}
            onClick={() => setCreating(true)}
          >
            Ghi điểm hôm nay
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
      {patient &&
        !eligibility.loading &&
        !eligibility.error &&
        !eligibility.data?.eligible && (
          <p className="care-note">
            Bạn cần có hồ sơ bệnh án mạn hợp lệ trước khi ghi điểm. Vui lòng
            liên hệ cơ sở khám.
          </p>
        )}
      <Success message={success} />
      <ErrorBox message={eligibility.error || list.error} />
      <div className="card">
        {!patientId ? (
          <Empty title="Chọn bệnh nhân để xem nhật ký" />
        ) : list.loading ? (
          <Loading />
        ) : list.data?.length ? (
          <Rows
            rows={list.data}
            columns={[
              "score_date",
              "hss_score",
              "iss_score",
              "diem_uas_ngay",
              "medical_record_id",
            ]}
          />
        ) : (
          <Empty title="Chưa ghi điểm" />
        )}
        <Pagination meta={list.meta} page={page} onChange={setPage} />
      </div>
      {creating && (
        <ActionForm
          title="Ghi điểm UAS hôm nay"
          fields={[
            f("hss_score", "Điểm sẩn phù (0–3)", {
              type: "number",
              min: 0,
              max: 3,
              required: true,
            }),
            f("iss_score", "Điểm ngứa (0–3)", {
              type: "number",
              min: 0,
              max: 3,
              required: true,
            }),
          ]}
          note="Chỉ ghi cho ngày hiện tại. Nếu đã ghi điểm hôm nay, hệ thống sẽ giữ bản ghi cũ và thông báo cho bạn."
          close={() => setCreating(false)}
          onSubmit={(d) => post("/uas7-scores", d)}
          saved={() => {
            setCreating(false);
            setSuccess("Đã ghi điểm UAS hôm nay.");
            list.reload();
          }}
        />
      )}
    </section>
  );
}
