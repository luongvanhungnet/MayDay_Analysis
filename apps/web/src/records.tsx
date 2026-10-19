import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  FileImage,
  FlaskConical,
  Plus,
  Save,
  Stethoscope,
  Trash2,
} from "lucide-react";
import { api, mediaBlob, post, put, upload } from "./api";
import { visibleQuestions, type AnswerValue } from "./form-logic";
import type {
  Answer,
  LabRequest,
  LabResult,
  MedicalRecord,
  Prescription,
  Question,
  Template,
  User,
} from "./types";
import { patientName, patientPhone, rows, userRole } from "./types";
import {
  Back,
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
  Pagination,
  SearchBox,
  Success,
  usePagedResource,
  useResource,
} from "./ui";
import { CreateRecordModal } from "./patients";

export function RecordsPage({ user }: { user: User }) {
  const [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [create, setCreate] = useState(false),
    [acceptError, setAcceptError] = useState(""),
    [accepting, setAccepting] = useState<string | null>(null);
  const isPatient = userRole(user) === "patient";
  const navigate = useNavigate();
  const records = usePagedResource<MedicalRecord>(
    `/medical_records/all?page=${page}&limit=25${status ? `&status=${status}` : ""}`,
  );
  const list = rows(records.data).filter(
    (r) =>
      (!status || r.status === status) &&
      `${patientName(r.patient)} ${patientPhone(r.patient)} ${r.id}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  async function accept(id: string) {
    setAccepting(id);
    setAcceptError("");
    try {
      await post(`/medical_records/${id}/accept`, {});
      navigate(`/records/${id}`);
    } catch (e) {
      setAcceptError((e as Error).message);
    } finally {
      setAccepting(null);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="KHÁM & ĐIỀU TRỊ"
        title="Hồ sơ bệnh án"
        description="Tiếp nhận, theo dõi và hoàn thành từng lượt khám."
        action={
          <Button onClick={() => setCreate(true)}>
            <Plus size={18} />
            Tạo hồ sơ
          </Button>
        }
      />
      <ErrorBox message={acceptError} />
      <Card>
        <div className="tabs">
          {[
            { value: "", label: "Tất cả hồ sơ" },
            { value: "pending", label: "Chờ tiếp nhận" },
            { value: "in_progress", label: "Đang khám" },
            { value: "completed", label: "Hoàn thành" },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => {
                setStatus(t.value);
                setPage(1);
              }}
              className={status === t.value ? "active" : ""}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="list-toolbar">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Tìm trong trang hiện tại…"
          />
          <span className="count-label">
            {records.meta?.total ?? list.length} hồ sơ
          </span>
        </div>
        <ErrorBox message={records.error} />
        {records.loading ? (
          <Loading />
        ) : !list.length ? (
          <Empty
            title="Chưa có hồ sơ phù hợp"
            text="Tạo lượt khám mới hoặc chọn trạng thái khác."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mã hồ sơ</th>
                  <th>Bệnh nhân</th>
                  <th>Mẫu phiếu</th>
                  <th>Ngày tạo</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link className="text-link" to={`/records/${r.id}`}>
                        HS · {r.id.slice(0, 8).toUpperCase()}
                      </Link>
                    </td>
                    <td>
                      <strong>{patientName(r.patient)}</strong>
                      <small>{patientPhone(r.patient)}</small>
                    </td>
                    <td>{r.template?.name || "Phiếu khám"}</td>
                    <td>{date(r.created_at)}</td>
                    <td>
                      <Badge status={r.status} />
                    </td>
                    <td>
                      {!isPatient && r.status === "pending" ? (
                        <Button
                          variant="secondary"
                          busy={accepting === r.id}
                          onClick={() => void accept(r.id)}
                        >
                          Tiếp nhận
                        </Button>
                      ) : (
                        <Link to={`/records/${r.id}`} aria-label="Xem hồ sơ">
                          <ArrowUpRight size={18} />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination meta={records.meta} page={page} onChange={setPage} />
      </Card>
      {create && (
        <CreateRecordModal
          isPatient={isPatient}
          onClose={() => setCreate(false)}
        />
      )}
    </>
  );
}
export function RecordDetail({ user }: { user: User }) {
  const { id } = useParams(),
    navigate = useNavigate();
  const record = useResource<MedicalRecord>(`/medical_records/${id}`),
    answerData = useResource<Answer[]>(`/medical_records/${id}/answers`),
    prescriptions = useResource<Prescription[]>(`/prescriptions/record/${id}`),
    labs = useResource<
      LabRequest[] | { requests?: LabRequest[]; results?: LabResult[] }
    >(`/lab-results/${id}`);
  const template = useResource<Template>(
    record.data?.template_id ? `/templates/${record.data.template_id}` : null,
  );
  const [tab, setTab] = useState("form"),
    [answers, setAnswers] = useState<Record<string, AnswerValue>>({}),
    [instructions, setInstructions] = useState(""),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState<"rx" | "lab" | "finalize" | null>(null);
  const isPatient = userRole(user) === "patient",
    isAdmin = userRole(user) === "admin",
    data = record.data;
  useEffect(() => {
    if (answerData.data)
      setAnswers(
        Object.fromEntries(
          rows(answerData.data).map((a) => [
            a.question_id,
            a.answer_value ?? a.value ?? a.answer_text ?? null,
          ]),
        ),
      );
  }, [answerData.data]);
  useEffect(() => {
    setInstructions(record.data?.instructions || "");
  }, [record.data?.instructions]);
  const questions = template.data?.sections?.flatMap((s) => s.questions) || [],
    visible = visibleQuestions(questions, answers),
    visibleIds = new Set(visible.map((q) => q.id));
  const editable =
    data?.status !== "completed" &&
    (isPatient
      ? data?.status === "pending"
      : data?.status === "in_progress" &&
        (isAdmin || data?.assigned_doctor_id === user.id));
  async function action(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await fn();
      setSuccess(message);
      record.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveAnswers(e: FormEvent) {
    e.preventDefault();
    await action(async () => {
      const allowedQuestions = (template.data?.sections || [])
        .filter(
          (section) =>
            isAdmin ||
            !section.filled_by ||
            section.filled_by === "both" ||
            section.filled_by === (isPatient ? "patient" : "doctor"),
        )
        .flatMap((section) => section.questions)
        .filter((q) => visibleIds.has(q.id));
      const missing = allowedQuestions.find((q) => {
        const value = answers[q.id];
        return (
          q.is_required &&
          (value === undefined ||
            value === null ||
            (typeof value === "string" && !value.trim()) ||
            (Array.isArray(value) && value.length === 0))
        );
      });
      if (missing)
        throw new Error(
          `Vui lòng trả lời câu hỏi bắt buộc: ${missing.content}`,
        );
      const values = allowedQuestions.map((q) => {
        const value = answers[q.id] ?? null;
        return {
          question_id: q.id,
          answer_value: value,
          ...(typeof value === "string" ? { answer_text: value } : {}),
          ...(q.type_question === "radio"
            ? {
                question_option_id: q.options?.find((o) => o.value === value)
                  ?.id,
              }
            : {}),
        };
      });
      await put(`/medical_records/${id}/answers`, { answers: values });
      answerData.reload();
    }, "Đã lưu câu trả lời phiếu khám.");
  }
  if (record.loading) return <Loading />;
  if (!data)
    return (
      <>
        <Back onClick={() => navigate("/records")} />
        <ErrorBox message={record.error || "Không tìm thấy hồ sơ."} />
        {!isPatient && (
          <Card>
            <div className="card-form">
              <p className="muted">
                Bác sĩ cần tiếp nhận hồ sơ đang chờ trước khi xem thông tin lâm
                sàng.
              </p>
              <ErrorBox message={error} />
              <Button
                busy={busy}
                onClick={() =>
                  action(
                    () => post(`/medical_records/${id}/accept`, {}),
                    "Đã tiếp nhận hồ sơ.",
                  )
                }
              >
                <Stethoscope size={17} />
                Tiếp nhận hồ sơ này
              </Button>
            </div>
          </Card>
        )}
      </>
    );
  const labRequests = Array.isArray(labs.data)
    ? labs.data
    : labs.data?.requests || [];
  return (
    <>
      <Back onClick={() => navigate("/records")} />
      <PageTitle
        eyebrow={`HỒ SƠ · ${data.id.slice(0, 8).toUpperCase()}`}
        title={patientName(data.patient)}
        description={`${patientPhone(data.patient)} · Ngày tạo ${date(data.created_at)} · ${template.data?.name || "Phiếu khám"}`}
        action={
          <div className="actions">
            <Badge status={data.status} />
            {!isPatient && data.status === "pending" && (
              <Button
                busy={busy}
                onClick={() =>
                  action(
                    () => post(`/medical_records/${id}/accept`, {}),
                    "Đã tiếp nhận hồ sơ.",
                  )
                }
              >
                <Stethoscope size={17} />
                Tiếp nhận khám
              </Button>
            )}
            {editable && !isPatient && (
              <Button onClick={() => setModal("finalize")}>
                <CheckCircle2 size={17} />
                Chốt bệnh án
              </Button>
            )}
          </div>
        }
      />
      <ErrorBox message={error} />
      <Success message={success} />
      <div className="record-meta">
        <span>
          <ClipboardList size={16} />
          Mẫu: {template.data?.name || "Đang tải…"}
        </span>
        <span>
          <Stethoscope size={16} />
          Bác sĩ:{" "}
          {data.assigned_doctor?.full_name ||
            (data.assigned_doctor_id ? "Đã được phân công" : "Chưa tiếp nhận")}
        </span>
        {data.completed_at && (
          <span>
            <CheckCircle2 size={16} />
            Hoàn thành {date(data.completed_at)}
          </span>
        )}
      </div>
      <div className="tabs page-tabs">
        {[
          { key: "form", label: "Phiếu khám" },
          { key: "rx", label: "Đơn thuốc" },
          { key: "lab", label: "Xét nghiệm" },
          { key: "notes", label: "Chỉ dẫn bác sĩ" },
        ].map((t) => (
          <button
            className={tab === t.key ? "active" : ""}
            key={t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "form" && (
        <form onSubmit={saveAnswers}>
          <ErrorBox message={template.error || answerData.error} />
          {template.loading || answerData.loading ? (
            <Loading />
          ) : !template.data?.sections?.length ? (
            <Card>
              <Empty title="Mẫu phiếu chưa có câu hỏi" />
            </Card>
          ) : (
            template.data.sections.map((section) => {
              const sectionEditable =
                editable &&
                (isAdmin ||
                  section.filled_by === "both" ||
                  !section.filled_by ||
                  section.filled_by === (isPatient ? "patient" : "doctor"));
              return (
                <Card
                  key={section.id}
                  title={section.title}
                  description={
                    section.description ||
                    `Người điền: ${section.filled_by === "patient" ? "Bệnh nhân" : section.filled_by === "doctor" ? "Bác sĩ" : "Bệnh nhân & bác sĩ"}`
                  }
                  className="form-section"
                >
                  <div className="card-form">
                    {section.questions
                      .filter((q) => visibleIds.has(q.id))
                      .map((q) => (
                        <QuestionInput
                          key={q.id}
                          question={q}
                          value={answers[q.id]}
                          onChange={(value) =>
                            setAnswers((a) => ({ ...a, [q.id]: value }))
                          }
                          disabled={!sectionEditable}
                        />
                      ))}
                    {!section.questions.filter((q) => visibleIds.has(q.id))
                      .length && (
                      <p className="muted">
                        Các câu hỏi của phần này chưa thỏa điều kiện hiển thị.
                      </p>
                    )}
                  </div>
                </Card>
              );
            })
          )}
          {editable && (
            <div className="sticky-actions">
              <span>Các câu hỏi có dấu * là bắt buộc.</span>
              <Button type="submit" busy={busy}>
                <Save size={17} />
                Lưu phiếu khám
              </Button>
            </div>
          )}
        </form>
      )}
      {tab === "rx" && (
        <Card
          title="Đơn thuốc"
          description="Liều dùng, tần suất và chỉ dẫn điều trị"
          action={
            editable &&
            !isPatient && (
              <Button onClick={() => setModal("rx")}>
                <Plus size={16} />
                Kê đơn
              </Button>
            )
          }
        >
          <ErrorBox message={prescriptions.error} />
          {prescriptions.loading ? (
            <Loading />
          ) : !rows(prescriptions.data).length ? (
            <Empty title="Chưa có đơn thuốc" />
          ) : (
            rows(prescriptions.data).map((rx) => (
              <div className="treatment-block" key={rx.id}>
                <div className="treatment-heading">
                  <strong>Đơn · {rx.id.slice(0, 8).toUpperCase()}</strong>
                  <span>{date(rx.created_at)}</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Thuốc</th>
                        <th>Liều dùng</th>
                        <th>Tần suất</th>
                        <th>Thời gian</th>
                        <th>Chỉ dẫn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rx.items.map((item, i) => (
                        <tr key={item.id || i}>
                          <td>
                            <strong>{item.medicine_name}</strong>
                          </td>
                          <td>{item.dosage || "—"}</td>
                          <td>{item.frequency || "—"}</td>
                          <td>{item.duration || "—"}</td>
                          <td>
                            {item.instruction || item.instructions || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(rx.note || rx.notes) && (
                  <p className="treatment-note">{rx.note || rx.notes}</p>
                )}
              </div>
            ))
          )}
        </Card>
      )}
      {tab === "lab" && (
        <Card
          title="Cận lâm sàng"
          description="Chỉ định và kết quả xét nghiệm"
          action={
            editable &&
            !isPatient && (
              <Button onClick={() => setModal("lab")}>
                <FlaskConical size={17} />
                Chỉ định xét nghiệm
              </Button>
            )
          }
        >
          <ErrorBox message={labs.error} />
          {labs.loading ? (
            <Loading />
          ) : !labRequests.length ? (
            <Empty title="Chưa có chỉ định xét nghiệm" />
          ) : (
            labRequests.map((lab) => (
              <div className="treatment-block" key={lab.id}>
                <div className="treatment-heading">
                  <strong>Chỉ định · {lab.id.slice(0, 8).toUpperCase()}</strong>
                  <span>{date(lab.created_at)}</span>
                </div>
                {lab.items.map((item) => (
                  <LabItemView
                    key={item.id}
                    item={item}
                    canEdit={!!editable && !isPatient}
                    onSaved={labs.reload}
                  />
                ))}
                {lab.note && <p className="treatment-note">{lab.note}</p>}
              </div>
            ))
          )}
        </Card>
      )}
      {tab === "notes" && (
        <Card
          title="Chỉ dẫn của bác sĩ"
          description={
            data.completed_at
              ? `Chốt bệnh án ngày ${date(data.completed_at)}`
              : "Được ghi nhận khi bác sĩ hoàn thành lượt khám"
          }
        >
          <div className="card-form">
            {data.instructions ? (
              <div className="clinical-notes">{data.instructions}</div>
            ) : (
              <Empty title="Chưa có chỉ dẫn lâm sàng" />
            )}
          </div>
        </Card>
      )}
      {modal === "rx" && (
        <PrescriptionModal
          recordId={data.id}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            prescriptions.reload();
            setSuccess("Đã tạo đơn thuốc.");
          }}
        />
      )}{" "}
      {modal === "lab" && (
        <LabModal
          recordId={data.id}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            labs.reload();
            setSuccess("Đã tạo chỉ định xét nghiệm.");
          }}
        />
      )}{" "}
      {modal === "finalize" && (
        <Modal title="Hoàn thành & chốt bệnh án" onClose={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                await put(`/medical_records/${id}`, { instructions });
                setModal(null);
              }, "Đã hoàn thành bệnh án.");
            }}
          >
            <div className="modal-body">
              <p className="muted">
                Sau khi chốt, câu trả lời và thông tin điều trị sẽ được khóa.
              </p>
              <Field label="Chỉ dẫn lâm sàng" required>
                <textarea
                  autoFocus
                  rows={6}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  required
                  placeholder="Nhận định, hướng dẫn điều trị và lịch tái khám…"
                />
              </Field>
              <ErrorBox message={error} />
            </div>
            <div className="modal-footer">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setModal(null)}
              >
                Tiếp tục khám
              </Button>
              <Button busy={busy} type="submit">
                Chốt bệnh án
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
export function MediaImage({ id }: { id: string }) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true,
      objectUrl = "";
    mediaBlob(id)
      .then((blob) => {
        if (active) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  return error ? (
    <span className="muted">Không tải được ảnh</span>
  ) : url ? (
    <a href={url} target="_blank" rel="noreferrer">
      <img className="clinical-image" src={url} alt="Ảnh đính kèm lâm sàng" />
    </a>
  ) : (
    <span className="image-placeholder">
      <FileImage size={22} />
    </span>
  );
}
function QuestionInput({
  question: q,
  value,
  onChange,
  disabled,
}: {
  question: Question;
  value?: AnswerValue;
  onChange: (v: AnswerValue) => void;
  disabled: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const textValue = value === null || value === undefined ? "" : String(value);
  async function attach(files: FileList | null) {
    if (!files) return;
    if (files.length > 10) {
      setError("Mỗi lần tải tối đa 10 ảnh.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const attachments = await upload(files);
      onChange([
        ...(Array.isArray(value) ? value : []),
        ...rows(attachments).map((m) => m.id),
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="question-field">
      <label className="question-label" htmlFor={`question-${q.id}`}>
        {q.content}
        {q.is_required && <em> *</em>}
      </label>
      {q.type_question === "radio" || q.type_question === "checkbox" ? (
        <div className="choice-list">
          {q.options?.map((o, i) => (
            <label key={o.id || i} className="choice">
              <input
                type={q.type_question}
                name={q.id}
                required={q.is_required && q.type_question === "radio"}
                disabled={disabled}
                checked={
                  q.type_question === "checkbox"
                    ? Array.isArray(value) && value.includes(o.value)
                    : value === o.value
                }
                onChange={(e) =>
                  q.type_question === "radio"
                    ? onChange(o.value)
                    : onChange(
                        e.target.checked
                          ? [...(Array.isArray(value) ? value : []), o.value]
                          : (Array.isArray(value) ? value : []).filter(
                              (v) => v !== o.value,
                            ),
                      )
                }
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      ) : q.type_question === "image_upload" ? (
        <>
          <div className="image-grid">
            {(Array.isArray(value) ? value : []).map((id) => (
              <div key={id}>
                <MediaImage id={id} />
                {!disabled && (
                  <button
                    type="button"
                    className="text-link danger-text"
                    onClick={() =>
                      onChange((value as string[]).filter((v) => v !== id))
                    }
                  >
                    Bỏ ảnh
                  </button>
                )}
              </div>
            ))}
          </div>
          {!disabled && (
            <label className="upload-zone">
              <FileImage size={24} />
              <strong>{busy ? "Đang tải ảnh…" : "Chọn ảnh đính kèm"}</strong>
              <small>Tối đa 10 ảnh mỗi lần · 5 MB mỗi ảnh</small>
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={busy}
                onChange={(e) => void attach(e.target.files)}
              />
            </label>
          )}
          <ErrorBox message={error} />
        </>
      ) : q.type_question === "text" ? (
        <textarea
          id={`question-${q.id}`}
          value={textValue}
          disabled={disabled}
          required={q.is_required}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nhập câu trả lời…"
        />
      ) : (
        <input
          id={`question-${q.id}`}
          type={q.type_question === "number" ? "number" : "date"}
          disabled={disabled}
          required={q.is_required}
          value={textValue}
          onChange={(e) =>
            onChange(
              q.type_question === "number"
                ? e.target.value === ""
                  ? null
                  : Number(e.target.value)
                : e.target.value,
            )
          }
        />
      )}
    </div>
  );
}
function PrescriptionModal({
  recordId,
  onClose,
  onSaved,
}: {
  recordId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const blank = {
    medicine_name: "",
    dosage: "",
    frequency: "",
    duration: "",
    instruction: "",
  };
  const [items, setItems] = useState([blank]),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("/prescriptions", {
        medical_record_id: recordId,
        note,
        items,
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Kê đơn thuốc" onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="modal-body">
          {items.map((item, index) => (
            <div className="editor-block" key={index}>
              <div className="editor-heading">
                <strong>Thuốc {index + 1}</strong>
                {items.length > 1 && (
                  <button
                    className="icon-button danger-text"
                    type="button"
                    onClick={() =>
                      setItems(items.filter((_, i) => i !== index))
                    }
                    aria-label="Xóa thuốc"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="form-grid">
                {[
                  { key: "medicine_name", label: "Tên thuốc", required: true },
                  { key: "dosage", label: "Liều dùng" },
                  { key: "frequency", label: "Tần suất" },
                  { key: "duration", label: "Thời gian điều trị" },
                ].map((f) => (
                  <Field label={f.label} required={f.required} key={f.key}>
                    <input
                      value={item[f.key as keyof typeof item]}
                      required={f.required}
                      onChange={(e) =>
                        setItems(
                          items.map((v, i) =>
                            i === index ? { ...v, [f.key]: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </Field>
                ))}
              </div>
              <Field label="Hướng dẫn sử dụng">
                <input
                  value={item.instruction}
                  onChange={(e) =>
                    setItems(
                      items.map((v, i) =>
                        i === index ? { ...v, instruction: e.target.value } : v,
                      ),
                    )
                  }
                />
              </Field>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() => setItems([...items, { ...blank }])}
          >
            <Plus size={16} />
            Thêm thuốc
          </Button>
          <Field label="Ghi chú đơn thuốc">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <ErrorBox message={error} />
        </div>
        <div className="modal-footer">
          <Button type="button" variant="secondary" onClick={onClose}>
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
function LabModal({
  recordId,
  onClose,
  onSaved,
}: {
  recordId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [items, setItems] = useState([{ test_name: "", description: "" }]),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("/lab-requests", { medical_record_id: recordId, note, items });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Chỉ định xét nghiệm" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          {items.map((item, i) => (
            <div className="editor-block" key={i}>
              <div className="editor-heading">
                <strong>Hạng mục {i + 1}</strong>
                {items.length > 1 && (
                  <button
                    type="button"
                    className="icon-button danger-text"
                    onClick={() => setItems(items.filter((_, j) => j !== i))}
                    aria-label="Xóa hạng mục"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <Field label="Tên xét nghiệm" required>
                <input
                  required
                  value={item.test_name}
                  onChange={(e) =>
                    setItems(
                      items.map((v, j) =>
                        j === i ? { ...v, test_name: e.target.value } : v,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Hướng dẫn / mô tả">
                <input
                  value={item.description}
                  onChange={(e) =>
                    setItems(
                      items.map((v, j) =>
                        j === i ? { ...v, description: e.target.value } : v,
                      ),
                    )
                  }
                />
              </Field>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setItems([...items, { test_name: "", description: "" }])
            }
          >
            <Plus size={16} />
            Thêm hạng mục
          </Button>
          <Field label="Ghi chú">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <ErrorBox message={error} />
        </div>
        <div className="modal-footer">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" busy={busy}>
            Lưu chỉ định
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function LabItemView({
  item,
  canEdit,
  onSaved,
}: {
  item: import("./types").LabItem;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false),
    [value, setValue] = useState(""),
    [unit, setUnit] = useState(""),
    [range, setRange] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const results = item.results || item.lab_results || [];
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("/lab-results", {
        lab_request_item_id: item.id,
        result_value: value,
        unit,
        reference_range: range,
      });
      setOpen(false);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="lab-item">
      <div className="treatment-heading">
        <div>
          <strong>{item.test_name}</strong>
          <small>{item.description || item.notes}</small>
        </div>
        {canEdit && (
          <Button variant="secondary" onClick={() => setOpen(!open)}>
            Nhập kết quả
          </Button>
        )}
      </div>
      {results.length ? (
        results.map((r) => (
          <div key={r.id} className="lab-result">
            <span>
              Kết quả:{" "}
              <strong>
                {r.result_value} {r.unit}
              </strong>
            </span>
            <span>Tham chiếu: {r.reference_range || "—"}</span>
            {r.notes && <span>{r.notes}</span>}
          </div>
        ))
      ) : (
        <span className="badge pending">Chờ kết quả</span>
      )}
      {open && (
        <form className="inline-form" onSubmit={submit}>
          <div className="form-grid">
            <Field label="Kết quả" required>
              <input
                required
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </Field>
            <Field label="Đơn vị">
              <input value={unit} onChange={(e) => setUnit(e.target.value)} />
            </Field>
            <Field label="Khoảng tham chiếu">
              <input value={range} onChange={(e) => setRange(e.target.value)} />
            </Field>
          </div>
          <ErrorBox message={error} />
          <Button type="submit" busy={busy}>
            Lưu kết quả
          </Button>
        </form>
      )}
    </div>
  );
}
