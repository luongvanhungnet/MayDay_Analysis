import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, ClipboardPlus, Plus, Users } from "lucide-react";
import { post } from "./api";
import type {
  ClassificationQuestion,
  MedicalRecord,
  Patient,
  Template,
} from "./types";
import { patientName, patientPhone, rows } from "./types";
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
  usePagedResource,
  useResource,
} from "./ui";

export function PatientPage() {
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [query, setQuery] = useState(""),
    [create, setCreate] = useState(false),
    [selected, setSelected] = useState<Patient | null>(null),
    [newRecord, setNewRecord] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(id);
  }, [search]);
  const patients = usePagedResource<Patient>(
      `/doctor/patients/search?search=${encodeURIComponent(query)}&page=${page}&limit=25`,
    ),
    history = useResource<MedicalRecord[]>(
      selected ? `/medical_records/patients/${selected.id}/history` : null,
    );
  if (selected)
    return (
      <>
        <Back onClick={() => setSelected(null)} />
        <PageTitle
          eyebrow="HỒ SƠ BỆNH NHÂN"
          title={patientName(selected)}
          description={`SĐT: ${patientPhone(selected)} · Mã BN: ${selected.id.slice(0, 8).toUpperCase()}`}
          action={
            <Button onClick={() => setNewRecord(true)}>
              <ClipboardPlus size={17} />
              Tạo lượt khám
            </Button>
          }
        />
        <div className="patient-overview">
          <div className="avatar large">
            {patientName(selected)
              .split(" ")
              .slice(-2)
              .map((x) => x[0])
              .join("")}
          </div>
          <div>
            <span className="eyebrow">THÔNG TIN NHÂN KHẨU HỌC</span>
            <div className="info-row">
              <div>
                <small>Năm sinh</small>
                <strong>{selected.year_of_birth || "—"}</strong>
              </div>
              <div>
                <small>Giới tính</small>
                <strong>
                  {{ male: "Nam", female: "Nữ", other: "Khác" }[
                    selected.gender || ""
                  ] || "—"}
                </strong>
              </div>
              <div>
                <small>Địa chỉ</small>
                <strong>{selected.address || "Chưa cập nhật"}</strong>
              </div>
            </div>
          </div>
        </div>
        <Card
          title="Lịch sử khám bệnh"
          description="Các hồ sơ thuộc phạm vi bác sĩ được cấp quyền"
        >
          <ErrorBox message={history.error} />
          {history.loading ? (
            <Loading />
          ) : rows(history.data).length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Hồ sơ</th>
                    <th>Mẫu phiếu</th>
                    <th>Ngày tạo</th>
                    <th>Trạng thái</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows(history.data).map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link className="text-link" to={`/records/${r.id}`}>
                          HS · {r.id.slice(0, 8).toUpperCase()}
                        </Link>
                      </td>
                      <td>{r.template?.name || "Phiếu khám"}</td>
                      <td>{date(r.created_at)}</td>
                      <td>
                        <Badge status={r.status} />
                      </td>
                      <td>
                        <Link to={`/records/${r.id}`} aria-label="Mở hồ sơ">
                          <ArrowUpRight size={17} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="Chưa có lượt khám" />
          )}
        </Card>
        {newRecord && (
          <CreateRecordModal
            patient={selected}
            onClose={() => setNewRecord(false)}
          />
        )}
      </>
    );
  return (
    <>
      <PageTitle
        eyebrow="QUẢN LÝ LÂM SÀNG"
        title="Bệnh nhân"
        description="Tìm kiếm, quản lý thông tin và theo dõi lịch sử khám bệnh."
        action={
          <Button onClick={() => setCreate(true)}>
            <Plus size={18} />
            Thêm bệnh nhân
          </Button>
        }
      />
      <Card>
        <div className="list-toolbar">
          <SearchBox value={search} onChange={setSearch} />
          <span className="count-label">
            <Users size={16} />
            {patients.meta?.total ?? rows(patients.data).length} bệnh nhân
          </span>
        </div>
        <ErrorBox message={patients.error} />
        {patients.loading ? (
          <Loading />
        ) : !rows(patients.data).length ? (
          <Empty
            title="Không tìm thấy bệnh nhân"
            text={
              query
                ? "Thử tìm bằng tên hoặc số điện thoại khác."
                : "Thêm bệnh nhân để bắt đầu quản lý lượt khám."
            }
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bệnh nhân</th>
                  <th>Số điện thoại</th>
                  <th>Năm sinh</th>
                  <th>Giới tính</th>
                  <th>Địa chỉ</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows(patients.data).map((p) => (
                  <tr
                    className="clickable"
                    key={p.id}
                    onClick={() => setSelected(p)}
                  >
                    <td>
                      <div className="patient-cell">
                        <div className="avatar small">
                          {patientName(p).split(" ").slice(-1)[0][0]}
                        </div>
                        <div>
                          <strong>{patientName(p)}</strong>
                          <small>BN · {p.id.slice(0, 8).toUpperCase()}</small>
                        </div>
                      </div>
                    </td>
                    <td>{patientPhone(p)}</td>
                    <td>{p.year_of_birth || "—"}</td>
                    <td>
                      {{ male: "Nam", female: "Nữ", other: "Khác" }[
                        p.gender || ""
                      ] || "—"}
                    </td>
                    <td className="truncate">{p.address || "—"}</td>
                    <td>
                      <ArrowUpRight size={17} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination meta={patients.meta} page={page} onChange={setPage} />
      </Card>
      {create && (
        <CreatePatientModal
          onClose={() => setCreate(false)}
          onCreated={() => {
            setCreate(false);
            patients.reload();
          }}
        />
      )}
    </>
  );
}
function CreatePatientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [birth, setBirth] = useState(""),
    [gender, setGender] = useState("female"),
    [address, setAddress] = useState(""),
    [created, setCreated] = useState<{ temporary_password?: string } | null>(
      null,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await post<{ temporary_password?: string }>(
        "/doctor/patients",
        {
          full_name: name.trim(),
          phone,
          year_of_birth: Number(birth),
          gender,
          address,
        },
      );
      setCreated(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (created)
    return (
      <Modal title="Đã tạo bệnh nhân" onClose={onCreated}>
        <div className="modal-body">
          <p>
            <strong>{name}</strong> đã được thêm vào danh sách bệnh nhân.
          </p>
          {created.temporary_password && (
            <>
              <p className="muted">Thông tin đăng nhập khởi tạo:</p>
              <Field label="Số điện thoại">
                <input value={phone} readOnly />
              </Field>
              <Field
                label="Mật khẩu tạm thời"
                hint="Cung cấp cho bệnh nhân và yêu cầu đổi mật khẩu sau lần đăng nhập đầu tiên."
              >
                <input value={created.temporary_password} readOnly />
              </Field>
            </>
          )}
        </div>
        <div className="modal-footer">
          <Button onClick={onCreated}>Hoàn tất</Button>
        </div>
      </Modal>
    );
  return (
    <Modal title="Thêm bệnh nhân" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <p className="muted">
            Tạo hồ sơ thông tin để tiếp nhận và quản lý khám bệnh.
          </p>
          <Field label="Họ và tên" required>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <Field label="Số điện thoại" required>
            <input
              type="tel"
              pattern="[0-9+]{9,15}"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </Field>
          <div className="form-grid">
            <Field label="Năm sinh" required>
              <input
                type="number"
                min={1900}
                max={new Date().getFullYear()}
                value={birth}
                onChange={(e) => setBirth(e.target.value)}
                required
              />
            </Field>
            <Field label="Giới tính">
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="female">Nữ</option>
                <option value="male">Nam</option>
                <option value="other">Khác</option>
              </select>
            </Field>
          </div>
          <Field label="Địa chỉ">
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </Field>
          <ErrorBox message={error} />
        </div>
        <div className="modal-footer">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" busy={busy}>
            Tạo bệnh nhân
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function CreateRecordModal({
  patient,
  onClose,
  isPatient = false,
}: {
  patient?: Patient;
  onClose: () => void;
  isPatient?: boolean;
}) {
  const [patientSearch, setPatientSearch] = useState("");
  const templates = useResource<Template[]>("/templates/all"),
    patients = useResource<Patient[]>(
      !patient && !isPatient
        ? `/doctor/patients/search?search=${encodeURIComponent(patientSearch)}`
        : null,
    );
  const [templateId, setTemplateId] = useState(""),
    [classify, setClassify] = useState(false),
    [screeningAnswers, setScreeningAnswers] = useState<Record<string, string>>(
      {},
    ),
    [patientId, setPatientId] = useState(patient?.id || ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const screening = useResource<ClassificationQuestion[]>(
    classify ? "/medical_records/classify-questions" : null,
  );
  async function classifyTemplate() {
    setBusy(true);
    setError("");
    try {
      const result = await post<{ template_id: string }>(
        "/medical_records/classify",
        {
          answers: rows(screening.data).map((q) => ({
            question_id: q.question_id || q.id,
            option_value: screeningAnswers[q.question_id || q.id],
          })),
        },
      );
      setTemplateId(result.template_id);
      setClassify(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const record = await post<{ id?: string; medical_record_id?: string }>(
        "/medical_records",
        {
          template_id: templateId,
          ...(!isPatient ? { patient_id: patientId } : {}),
        },
      );
      const id = record.id || record.medical_record_id;
      if (!id) throw new Error("Máy chủ chưa trả về mã hồ sơ.");
      navigate(`/records/${id}`);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Tạo hồ sơ bệnh án" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <p className="muted">
            Chọn mẫu phiếu phù hợp để bắt đầu lượt khám mới.
          </p>
          {!patient && !isPatient && (
            <Field label="Tìm bệnh nhân">
              <input
                placeholder="Tên hoặc số điện thoại…"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
              />
            </Field>
          )}
          {!isPatient && (
            <Field label="Bệnh nhân" required>
              {patient ? (
                <input disabled value={patientName(patient)} />
              ) : (
                <select
                  required
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                >
                  <option value="">Chọn bệnh nhân</option>
                  {rows(patients.data).map((p) => (
                    <option key={p.id} value={p.id}>
                      {patientName(p)} · {patientPhone(p)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          <Field label="Mẫu phiếu khám" required>
            <select
              required
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">Chọn mẫu phiếu</option>
              {rows(templates.data)
                .filter((t) => t.is_active && t.kind !== "classification")
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </Field>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setClassify(!classify)}
          >
            {classify ? "Ẩn câu hỏi phân loại" : "Gợi ý mẫu theo khai báo"}
          </Button>
          {classify && (
            <div className="editor-block">
              <p className="muted">
                Trả lời khai báo để hệ thống chọn mẫu phiếu phù hợp.
              </p>
              {screening.loading ? (
                <Loading />
              ) : (
                rows(screening.data).map((q) => (
                  <div className="question-field" key={q.id}>
                    <span className="question-label">
                      {q.question_text || q.content}
                    </span>
                    <div className="choice-list">
                      {q.options.map((o, i) => (
                        <label className="choice" key={o.id || i}>
                          <input
                            type="radio"
                            name={`screening-${q.id}`}
                            checked={
                              screeningAnswers[q.question_id || q.id] ===
                              (o.option_value ?? o.value)
                            }
                            onChange={() =>
                              setScreeningAnswers((a) => ({
                                ...a,
                                [q.question_id || q.id]:
                                  o.option_value ?? o.value,
                              }))
                            }
                          />
                          {o.option_text || o.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))
              )}
              <ErrorBox message={screening.error} />
              <Button
                type="button"
                variant="secondary"
                busy={busy}
                disabled={
                  !rows(screening.data).length ||
                  rows(screening.data).some(
                    (q) => !screeningAnswers[q.question_id || q.id],
                  )
                }
                onClick={() => void classifyTemplate()}
              >
                Chọn mẫu phù hợp
              </Button>
            </div>
          )}
          <ErrorBox message={error || templates.error || patients.error} />
        </div>
        <div className="modal-footer">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            type="submit"
            busy={busy}
            disabled={!templateId || (!patientId && !isPatient)}
          >
            Tạo hồ sơ
          </Button>
        </div>
      </form>
    </Modal>
  );
}
