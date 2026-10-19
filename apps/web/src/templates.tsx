import { useState, type FormEvent } from "react";
import {
  Check,
  ChevronDown,
  FileHeart,
  GitBranch,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { post, put, remove } from "./api";
import type {
  ClassificationQuestion,
  Question,
  Section,
  Template,
} from "./types";
import { rows } from "./types";
import {
  Back,
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  Field,
  Loading,
  Modal,
  PageTitle,
  Success,
  useResource,
} from "./ui";

const types = [
  { value: "text", label: "Văn bản" },
  { value: "number", label: "Số" },
  { value: "date", label: "Ngày" },
  { value: "radio", label: "Chọn một" },
  { value: "checkbox", label: "Chọn nhiều" },
  { value: "image_upload", label: "Tải ảnh" },
];
export function TemplatesPage() {
  const templates = useResource<Template[]>("/templates/all"),
    [selected, setSelected] = useState<string | null>(null),
    [editing, setEditing] = useState<Template | "new" | null>(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  if (selected)
    return (
      <TemplateDetail
        id={selected}
        onBack={() => {
          setSelected(null);
          templates.reload();
        }}
      />
    );
  return (
    <>
      <PageTitle
        eyebrow="BIỂU MẪU ĐỘNG"
        title="Mẫu phiếu khám"
        description="Xây dựng phiếu khám linh hoạt cho từng nhu cầu chuyên khoa."
        action={
          <Button onClick={() => setEditing("new")}>
            <Plus size={18} />
            Tạo mẫu phiếu
          </Button>
        }
      />
      <ErrorBox message={error || templates.error} />
      <Success message={success} />
      {templates.loading ? (
        <Loading />
      ) : !rows(templates.data).length ? (
        <Card>
          <Empty
            title="Chưa có mẫu phiếu khám"
            text="Tạo mẫu, thêm phần và câu hỏi để bắt đầu thu thập dữ liệu."
          />
        </Card>
      ) : (
        <div className="template-grid">
          {rows(templates.data).map((t) => (
            <article className="template-card" key={t.id}>
              <div className="template-card-top">
                <span className="template-icon">
                  <FileHeart size={25} />
                </span>
                <Badge status={t.is_active ? "active" : "inactive"} />
              </div>
              <span className="eyebrow">{t.code_template}</span>
              <h2>{t.name}</h2>
              <p>{t.description || "Mẫu phiếu khám chuyên khoa"}</p>
              <div className="template-card-footer">
                <span>
                  {t.sections?.length ?? t._count?.sections ?? "—"} phần · Phiên bản{" "}
                  {t.version || "1"}
                </span>
                <button className="text-link" onClick={() => setSelected(t.id)}>
                  Mở biểu mẫu <ChevronDown size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {editing && (
        <TemplateModal
          template={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            templates.reload();
            setSuccess("Đã lưu mẫu phiếu.");
            setError("");
          }}
        />
      )}
    </>
  );
}
function TemplateDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const template = useResource<Template>(`/templates/${id}`),
    [modal, setModal] = useState<{
      kind: "template" | "section" | "question";
      section?: Section;
      question?: Question;
    } | null>(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [deleting, setDeleting] = useState<{ name: string; path: string } | null>(
      null,
    ),
    [busy, setBusy] = useState(false);
  const data = template.data;
  async function doDelete() {
    if (!deleting) return;
    setBusy(true);
    setError("");
    try {
      await remove(deleting.path);
      setDeleting(null);
      if (deleting.path === `/templates/${id}`) onBack();
      else template.reload();
      setSuccess("Đã xóa mục khỏi biểu mẫu.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const saved = () => {
    setModal(null);
    template.reload();
    setSuccess("Đã lưu cấu trúc biểu mẫu.");
  };
  return (
    <>
      <Back onClick={onBack} />
      {template.loading ? (
        <Loading />
      ) : (
        data && (
          <>
            <PageTitle
              eyebrow={data.code_template}
              title={data.name}
              description={data.description || "Cấu trúc mẫu phiếu khám"}
              action={
                <div className="actions">
                  <Button
                    variant="secondary"
                    onClick={() => setModal({ kind: "template" })}
                  >
                    <Pencil size={16} />
                    Thông tin mẫu
                  </Button>
                  <Button onClick={() => setModal({ kind: "section" })}>
                    <Plus size={16} />
                    Thêm phần
                  </Button>
                </div>
              }
            />
            <ErrorBox message={error || template.error} />
            <Success message={success} />
            <div className="builder-note">
              <GitBranch size={19} />
              <span>
                Biểu mẫu gồm các phần, câu hỏi và lựa chọn. Câu hỏi phụ chỉ hiển
                thị khi đáp án cha phù hợp. Mẫu đã dùng trong bệnh án được bảo
                vệ; tạo mẫu mới để thay đổi cấu trúc.
              </span>
            </div>
            {!data.sections?.length && (
              <Card>
                <Empty
                  title="Thêm phần đầu tiên"
                  text="Ví dụ: Tiền sử bệnh, Triệu chứng hoặc Khám lâm sàng."
                />
              </Card>
            )}
            {data.sections?.map((section) => (
              <Card
                className="builder-section"
                key={section.id}
                title={section.title}
                description={`${section.questions.length} câu hỏi · ${section.filled_by === "doctor" ? "Bác sĩ điền" : section.filled_by === "patient" ? "Bệnh nhân điền" : "Bệnh nhân & bác sĩ"}`}
                action={
                  <div className="actions">
                    <button
                      className="icon-button"
                      onClick={() => setModal({ kind: "section", section })}
                      aria-label="Sửa phần"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-button danger-text"
                      onClick={() =>
                        setDeleting({
                          name: section.title,
                          path: `/templates/sections/${section.id}`,
                        })
                      }
                      aria-label="Xóa phần"
                    >
                      <Trash2 size={16} />
                    </button>
                    <Button
                      variant="secondary"
                      onClick={() => setModal({ kind: "question", section })}
                    >
                      <Plus size={15} />
                      Câu hỏi
                    </Button>
                  </div>
                }
              >
                <div className="question-preview-list">
                  {section.questions.map((q, i) => (
                    <div className="question-preview" key={q.id}>
                      <span className="question-number">{i + 1}</span>
                      <div className="question-preview-content">
                        <strong>
                          {q.content}
                          {q.is_required && <em> *</em>}
                        </strong>
                        <div className="question-tags">
                          <span>
                            {types.find((t) => t.value === q.type_question)
                              ?.label || q.type_question}
                          </span>
                          {q.parent_question_id && (
                            <span>
                              <GitBranch size={12} />
                              Có điều kiện
                            </span>
                          )}
                        </div>
                        {q.options?.length ? (
                          <div className="option-preview">
                            {q.options.map((o, j) => (
                              <span key={o.id || j}>{o.label}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <button
                        className="icon-button"
                        aria-label="Sửa câu hỏi"
                        onClick={() =>
                          setModal({ kind: "question", section, question: q })
                        }
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-button danger-text"
                        aria-label="Xóa câu hỏi"
                        onClick={() =>
                          setDeleting({
                            name: q.content,
                            path: `/templates/questions/${q.id}`,
                          })
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
            <div className="builder-bottom">
              <button
                className="text-link danger-text"
                onClick={() =>
                  setDeleting({ name: data.name, path: `/templates/${id}` })
                }
              >
                <Trash2 size={16} />
                Xóa mẫu phiếu
              </button>
            </div>
            {modal?.kind === "template" && (
              <TemplateModal
                template={data}
                onClose={() => setModal(null)}
                onSaved={saved}
              />
            )}{" "}
            {modal?.kind === "section" && (
              <SectionModal
                templateId={id}
                section={modal.section}
                onClose={() => setModal(null)}
                onSaved={saved}
              />
            )}{" "}
            {modal?.kind === "question" && modal.section && (
              <QuestionModal
                template={data}
                section={modal.section}
                question={modal.question}
                onClose={() => setModal(null)}
                onSaved={saved}
              />
            )}
          </>
        )
      )}
      {deleting && (
        <Modal title="Xóa khỏi biểu mẫu" onClose={() => setDeleting(null)}>
          <div className="modal-body">
            <p>
              Xóa <strong>{deleting.name}</strong> cùng các dữ liệu cấu trúc bên
              trong?
            </p>
            <ErrorBox message={error} />
          </div>
          <div className="modal-footer">
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Hủy
            </Button>
            <Button variant="danger" busy={busy} onClick={doDelete}>
              Xóa mục
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
function TemplateModal({
  template,
  onClose,
  onSaved,
}: {
  template?: Template;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(template?.name || ""),
    [code, setCode] = useState(template?.code_template || ""),
    [description, setDescription] = useState(template?.description || ""),
    [active, setActive] = useState(template?.is_active ?? true),
    [kind, setKind] = useState(template?.kind || "clinical"),
    [priority, setPriority] = useState(
      template?.classification_rules?.priority || 0,
    ),
    [conditions, setConditions] = useState<
      { question_id: string; value: string }[]
    >(template?.classification_rules?.conditions || []),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const screening = useResource<ClassificationQuestion[]>(
    kind === "clinical" ? "/medical_records/classify-questions" : null,
  );
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        name,
        code_template: code,
        description,
        is_active: active,
        kind,
        classification_rules:
          kind === "clinical" && conditions.length
            ? { priority, conditions }
            : null,
      };
      if (template) await put(`/templates/${template.id}`, payload);
      else await post("/templates", payload);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={template ? "Thông tin mẫu phiếu" : "Tạo mẫu phiếu khám"}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="modal-body">
          <Field label="Tên mẫu phiếu" required>
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field
            label="Mã mẫu phiếu"
            required
            hint="Mã duy nhất, ví dụ TMPL_URTICARIA"
          >
            <input
              required
              pattern="[A-Za-z0-9_-]+"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
          <Field label="Mô tả">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label="Loại biểu mẫu">
            <select
              value={kind}
              onChange={(e) =>
                setKind(e.target.value as "clinical" | "classification")
              }
            >
              <option value="clinical">Phiếu khám lâm sàng</option>
              <option value="classification">
                Khai báo phân loại mẫu phiếu
              </option>
            </select>
          </Field>
          {kind === "clinical" && (
            <div className="editor-block">
              <div className="editor-heading">
                <strong>Quy tắc chọn mẫu qua khai báo</strong>
              </div>
              <p className="muted">
                Mẫu được chọn khi tất cả điều kiện phù hợp. Độ ưu tiên cao được
                xét trước.
              </p>
              {conditions.length > 0 && (
                <Field label="Độ ưu tiên">
                  <input
                    type="number"
                    min={0}
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                  />
                </Field>
              )}
              {conditions.map((condition, i) => {
                const question = rows(screening.data).find(
                  (q) => (q.question_id || q.id) === condition.question_id,
                );
                return (
                  <div className="classification-condition" key={i}>
                    <Field label="Câu hỏi phân loại" required>
                      <select
                        required
                        value={condition.question_id}
                        onChange={(e) =>
                          setConditions(
                            conditions.map((c, j) =>
                              i === j
                                ? { question_id: e.target.value, value: "" }
                                : c,
                            ),
                          )
                        }
                      >
                        <option value="">Chọn câu hỏi</option>
                        {rows(screening.data).map((q) => (
                          <option key={q.id} value={q.question_id || q.id}>
                            {q.question_text || q.content}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Đáp án cần khớp" required>
                      <select
                        required
                        value={condition.value}
                        onChange={(e) =>
                          setConditions(
                            conditions.map((c, j) =>
                              i === j ? { ...c, value: e.target.value } : c,
                            ),
                          )
                        }
                      >
                        <option value="">Chọn đáp án</option>
                        {question?.options.map((o, j) => (
                          <option
                            key={o.id || j}
                            value={o.option_value ?? o.value}
                          >
                            {o.option_text || o.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <button
                      type="button"
                      className="icon-button danger-text"
                      aria-label="Xóa điều kiện phân loại"
                      onClick={() =>
                        setConditions(conditions.filter((_, j) => j !== i))
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
              <Button
                type="button"
                variant="secondary"
                disabled={screening.loading || !rows(screening.data).length}
                onClick={() =>
                  setConditions([...conditions, { question_id: "", value: "" }])
                }
              >
                <Plus size={15} />
                Thêm điều kiện
              </Button>
              <ErrorBox message={screening.error} />
            </div>
          )}
          <label className="choice">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Đang hoạt động
          </label>
          <ErrorBox message={error} />
        </div>
        <div className="modal-footer">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" busy={busy}>
            <Save size={16} />
            Lưu mẫu
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function SectionModal({
  templateId,
  section,
  onClose,
  onSaved,
}: {
  templateId: string;
  section?: Section;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(section?.title || ""),
    [description, setDescription] = useState(section?.description || ""),
    [filledBy, setFilledBy] = useState(section?.filled_by || "both"),
    [order, setOrder] = useState(section?.order || 0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = { title, description, filled_by: filledBy, order };
      if (section) await put(`/templates/sections/${section.id}`, payload);
      else await post(`/templates/${templateId}/sections`, payload);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={section ? "Chỉnh sửa phần" : "Thêm phần biểu mẫu"}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="modal-body">
          <Field label="Tên phần" required>
            <input
              autoFocus
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="Mô tả">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <div className="form-grid">
            <Field label="Người điền">
              <select
                value={filledBy}
                onChange={(e) => setFilledBy(e.target.value)}
              >
                <option value="both">Bệnh nhân & bác sĩ</option>
                <option value="patient">Bệnh nhân</option>
                <option value="doctor">Bác sĩ</option>
              </select>
            </Field>
            <Field label="Thứ tự">
              <input
                type="number"
                min={0}
                value={order}
                onChange={(e) => setOrder(Number(e.target.value))}
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
            Lưu phần
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function QuestionModal({
  template,
  section,
  question,
  onClose,
  onSaved,
}: {
  template: Template;
  section: Section;
  question?: Question;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isClassification = template.kind === "classification";
  const [content, setContent] = useState(question?.content || ""),
    [type, setType] = useState(
      isClassification ? "radio" : question?.type_question || "text",
    ),
    [required, setRequired] = useState(
      isClassification || question?.is_required || false,
    ),
    [order, setOrder] = useState(question?.order || section.questions.length),
    [options, setOptions] = useState(
      question?.options?.map((o) => ({ label: o.label, value: o.value })) || [
        { label: "", value: "" },
      ],
    ),
    [parent, setParent] = useState(question?.parent_question_id || ""),
    [condition, setCondition] = useState(
      String(question?.show_if_answer ?? ""),
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const parents =
      template.sections
        ?.flatMap((s) => s.questions)
        .filter((q) => q.id !== question?.id) || [],
    parentQuestion = parents.find((q) => q.id === parent);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        content,
        type_question: isClassification ? "radio" : type,
        is_required: isClassification || required,
        order,
        parent_question_id: isClassification ? null : parent || null,
        ...(isClassification ? { condition_rules: null } : {}),
        show_if_answer:
          !isClassification && parent
            ? parentQuestion?.type_question === "number"
              ? Number(condition)
              : condition
            : null,
        options: ["radio", "checkbox"].includes(type)
          ? options.map((o, i) => ({ ...o, order: i }))
          : [],
      };
      if (question) await put(`/templates/questions/${question.id}`, payload);
      else await post(`/templates/sections/${section.id}/questions`, payload);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={question ? "Chỉnh sửa câu hỏi" : "Thêm câu hỏi"}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit}>
        <div className="modal-body">
          {isClassification && (
            <p className="muted">
              Câu hỏi phân loại luôn hiển thị và cần chọn một đáp án trong mỗi
              lần khai báo.
            </p>
          )}
          <Field label="Nội dung câu hỏi" required>
            <textarea
              autoFocus
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </Field>
          <div className="form-grid">
            <Field label="Loại câu hỏi">
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {types
                  .filter((t) => !isClassification || t.value === "radio")
                  .map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Thứ tự">
              <input
                type="number"
                min={0}
                value={order}
                onChange={(e) => setOrder(Number(e.target.value))}
              />
            </Field>
          </div>
          <label className="choice">
            <input
              type="checkbox"
              checked={required}
              disabled={isClassification}
              onChange={(e) => setRequired(e.target.checked)}
            />
            Bắt buộc trả lời
          </label>
          {["radio", "checkbox"].includes(type) && (
            <div className="editor-block">
              <div className="editor-heading">
                <strong>Lựa chọn trả lời</strong>
              </div>
              {options.map((o, i) => (
                <div key={i} className="option-edit">
                  <input
                    required
                    aria-label={`Nhãn lựa chọn ${i + 1}`}
                    placeholder="Nội dung hiển thị"
                    value={o.label}
                    onChange={(e) =>
                      setOptions(
                        options.map((v, j) =>
                          j === i ? { ...v, label: e.target.value } : v,
                        ),
                      )
                    }
                  />
                  <input
                    required
                    aria-label={`Giá trị lựa chọn ${i + 1}`}
                    placeholder="Giá trị lưu"
                    value={o.value}
                    onChange={(e) =>
                      setOptions(
                        options.map((v, j) =>
                          j === i ? { ...v, value: e.target.value } : v,
                        ),
                      )
                    }
                  />
                  <button
                    className="icon-button danger-text"
                    type="button"
                    aria-label="Xóa lựa chọn"
                    disabled={options.length === 1}
                    onClick={() =>
                      setOptions(options.filter((_, j) => j !== i))
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setOptions([...options, { label: "", value: "" }])
                }
              >
                <Plus size={15} />
                Thêm lựa chọn
              </Button>
            </div>
          )}
          {!isClassification && (
            <div className="editor-block">
              <div className="editor-heading">
                <strong>
                  <GitBranch size={16} />
                  Điều kiện hiển thị
                </strong>
              </div>
              <Field label="Câu hỏi cha">
                <select
                  value={parent}
                  onChange={(e) => {
                    setParent(e.target.value);
                    setCondition("");
                  }}
                >
                  <option value="">Luôn hiển thị</option>
                  {parents.map((q) => (
                    <option value={q.id} key={q.id}>
                      {q.content}
                    </option>
                  ))}
                </select>
              </Field>
              {parent && (
                <Field label="Hiển thị khi câu trả lời cha bằng" required>
                  {parentQuestion?.options?.length ? (
                    <select
                      required
                      value={condition}
                      onChange={(e) => setCondition(e.target.value)}
                    >
                      <option value="">Chọn đáp án</option>
                      {parentQuestion.options.map((o, i) => (
                        <option key={i} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      required
                      type={
                        parentQuestion?.type_question === "number"
                          ? "number"
                          : "text"
                      }
                      value={condition}
                      onChange={(e) => setCondition(e.target.value)}
                    />
                  )}
                </Field>
              )}
            </div>
          )}
          <ErrorBox message={error} />
        </div>
        <div className="modal-footer">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" busy={busy}>
            <Check size={16} />
            Lưu câu hỏi
          </Button>
        </div>
      </form>
    </Modal>
  );
}
