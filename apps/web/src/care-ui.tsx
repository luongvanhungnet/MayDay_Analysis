import { confirmAction } from "./confirmation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { api, apiPage, patch, post, put, remove } from "./api";
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
} from "./ui";
import {
  buildPayload,
  choiceLabels,
  names,
  resources,
  type InputField,
  type Resource,
  type Row,
} from "./care-model";
import { display, label } from "./native-model";

export function useSearch() {
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  return { search, setSearch, query };
}
export function ReferenceSelect({
  reference,
  value,
  onChange,
  required,
  labelText,
}: {
  reference: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  labelText?: string;
}) {
  const { search, setSearch, query } = useSearch();
  const path =
    reference === "patients"
      ? "/doctor/patients/search"
      : reference.startsWith("records")
        ? "/medical_records/all"
        : reference.startsWith("files:")
          ? `/image-attachments/user/${encodeURIComponent(reference.slice(6))}`
          : (resources[reference]?.path ?? "/admin/users");
  const [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(1),
    [more, setMore] = useState(false);
  useEffect(() => {
    setPage(1);
    setRows([]);
  }, [query, reference]);
  useEffect(() => {
    if (!path) return;
    const abort = new AbortController();
    setBusy(true);
    setError("");
    void apiPage<Row>(
      `${path}?limit=25&page=${page}${reference.startsWith("files:") ? "" : `&search=${encodeURIComponent(query)}`}${reference.startsWith("records:") ? `&patient_id=${encodeURIComponent(reference.slice(8))}&record_type=MAN` : ""}`,
      { signal: abort.signal },
    )
      .then((result) => {
        if (!abort.signal.aborted) {
          setRows((old) =>
            page === 1 ? result.items : [...old, ...result.items],
          );
          setMore(
            result.meta
              ? page * 25 < result.meta.total
              : result.items.length === 25,
          );
        }
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setBusy(false);
      });
    return () => abort.abort();
  }, [path, query, page, reference]);
  return (
    <div className="care-reference">
      {!reference.startsWith("files:") && (
        <input
          aria-label={`Tìm ${labelText ?? reference}`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên…"
        />
      )}
      <select
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={labelText ?? reference}
      >
        <option value="">{busy ? "Đang tải…" : "Chọn một mục"}</option>
        {value && !rows.some((r) => String(r.id) === value) && (
          <option value={value}>Đang chọn · #{value}</option>
        )}
        {rows.map((row) => (
          <option key={String(row.id)} value={String(row.id)}>
            {String(
              row.name ??
                row.full_name ??
                row.username ??
                row.file_name ??
                `Hồ sơ #${row.id}`,
            )}
            {row.phone
              ? ` · ${row.phone}`
              : row.patient_id
                ? ` · Bệnh nhân #${row.patient_id}`
                : ""}
            {row.status ? ` · ${row.status}` : ""}
          </option>
        ))}
      </select>
      {more && (
        <button
          type="button"
          className="text-link"
          disabled={busy}
          onClick={() => setPage((p) => p + 1)}
        >
          Tải thêm lựa chọn
        </button>
      )}
      <ErrorBox message={error} />
    </div>
  );
}
export function FormFields({
  fields,
  values,
  setValues,
}: {
  fields: InputField[];
  values: Record<string, string>;
  setValues: (next: Record<string, string>) => void;
}) {
  return (
    <div className="form-grid">
      {fields.map((f) => {
        const value = values[f.name] ?? "",
          change = (v: string) => setValues({ ...values, [f.name]: v });
        return (
          <Field key={f.name} label={f.label} required={f.required}>
            {f.reference ? (
              <ReferenceSelect
                reference={f.reference}
                value={value}
                onChange={change}
                required={f.required}
                labelText={f.label}
              />
            ) : f.type === "textarea" ? (
              <textarea
                rows={3}
                value={value}
                required={f.required}
                onChange={(e) => change(e.target.value)}
              />
            ) : f.type === "select" || f.type === "boolean" ? (
              <select
                value={value}
                required={f.required}
                onChange={(e) => change(e.target.value)}
              >
                <option value="">Chọn…</option>
                {(f.type === "boolean"
                  ? ["true", "false"]
                  : (f.options ?? [])
                ).map((v) => (
                  <option key={v} value={v}>
                    {v === "true"
                      ? "Có"
                      : v === "false"
                        ? "Không"
                        : (choiceLabels[v] ?? v)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={value}
                type={f.type ?? "text"}
                required={f.required}
                min={f.min}
                max={f.max}
                minLength={f.type === "password" ? 10 : undefined}
                autoComplete={
                  f.type === "password" ? "new-password" : undefined
                }
                onChange={(e) => change(e.target.value)}
              />
            )}
          </Field>
        );
      })}
    </div>
  );
}
export function ActionForm({
  title,
  fields,
  original,
  close,
  onSubmit,
  saved,
  note,
  submitText = "Lưu thông tin",
}: {
  title: string;
  fields: InputField[];
  original?: Row;
  close: () => void;
  onSubmit: (data: Row) => Promise<unknown>;
  saved: () => void;
  note?: string;
  submitText?: string;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
      Object.fromEntries(
        fields.map((f) => [
          f.name,
          original?.[f.name] === null || original?.[f.name] === undefined
            ? ""
            : f.type === "datetime-local"
              ? localTime(String(original[f.name]))
              : String(original[f.name]),
        ]),
      ),
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onSubmit(buildPayload(fields, values, original));
      saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={title}
      onClose={() => {
        if (!busy) close();
      }}
      wide
    >
      <form onSubmit={submit}>
        <div className="modal-body">
          {note && <p className="care-note">{note}</p>}
          <FormFields fields={fields} values={values} setValues={setValues} />
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
            {submitText}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function localTime(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
}
export function Details({ data }: { data: Row }) {
  return (
    <dl className="care-details">
      {Object.entries(data)
        .filter(([k]) => !k.startsWith("_") && !k.startsWith("ma_subtype"))
        .map(([k, v]) => (
          <div key={k}>
            <dt>
              {k.includes("Toketquacanlamsang")
                ? "Chi tiết kết quả"
                : (names[k] ?? label(k))}
            </dt>
            <dd>
              {v !== null && typeof v === "object" ? (
                <details>
                  <summary>Xem thông tin</summary>
                  {(Array.isArray(v) ? v : [v]).map((item, i) =>
                    item && typeof item === "object" ? (
                      <Details key={i} data={item as Row} />
                    ) : (
                      <p key={i}>{display(item)}</p>
                    ),
                  )}
                </details>
              ) : k === "status" ? (
                <Badge status={String(v ?? "")} />
              ) : (
                (choiceLabels[String(v)] ?? display(v))
              )}
            </dd>
          </div>
        ))}
    </dl>
  );
}
export function Rows({
  rows,
  columns,
  actions,
}: {
  rows: Row[];
  columns: string[];
  actions?: (r: Row) => ReactNode;
}) {
  return (
    <div className="table-scroll care-table">
      <table>
        <thead>
          <tr>
            {columns.map((k) => (
              <th key={k}>{names[k] ?? label(k)}</th>
            ))}
            {actions && <th>Thao tác</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={String(row.id ?? i)}>
              {columns.map((k) => (
                <td key={k}>
                  {k === "status" ? (
                    <Badge status={String(row[k] ?? "")} />
                  ) : (
                    <span className="native-cell" title={display(row[k])}>
                      {choiceLabels[String(row[k])] ?? display(row[k])}
                    </span>
                  )}
                </td>
              ))}
              {actions && (
                <td>
                  <div className="care-row-actions">{actions(row)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function ResourcePage({
  config,
  userRole,
}: {
  config: Resource;
  userRole: string;
}) {
  const [page, setPage] = useState(1),
    [editing, setEditing] = useState<Row | null | undefined>(),
    [detail, setDetail] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const { search, setSearch, query } = useSearch();
  useEffect(() => setPage(1), [query]);
  const data = usePagedResource<Row>(
      `${config.path}?page=${page}&search=${encodeURIComponent(query)}`,
    ),
    canWrite = (!config.admin || userRole === "admin") && !config.readOnly;
  const saved = () => {
    setEditing(undefined);
    setSuccess("Đã lưu thông tin.");
    data.reload();
  };
  async function view(row: Row) {
    setError("");
    try {
      setDetail(
        ["/roles", "/permissions"].includes(config.path)
          ? row
          : await api<Row>(`${config.path}/${row.id}`),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function erase(row: Row) {
    if (
      !(await confirmAction(
        "Xóa mục này? Dữ liệu đang được sử dụng sẽ không thể xóa.",
      ))
    )
      return;
    setError("");
    try {
      await remove(`${config.path}/${row.id}`);
      setSuccess("Đã xóa.");
      data.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="native-content">
      <div className="page-title">
        <div>
          <span className="eyebrow">QUẢN LÝ THÔNG TIN</span>
          <h1>{config.title}</h1>
          <p className="muted">
            {data.meta?.total ?? data.data?.length ?? "—"} mục
          </p>
        </div>
        {canWrite && !config.noCreate && (
          <Button onClick={() => setEditing(null)}>Thêm mới</Button>
        )}
      </div>
      {config.path === "/roles" && (
        <p className="care-note">
          Vai trò hiện có được dùng cho phân quyền. Vai trò mới cần được cấu
          hình chính sách trước khi sử dụng cho khám bệnh.
        </p>
      )}
      <Success message={success} />
      <ErrorBox message={error || data.error} />
      <div className="card">
        <div className="native-toolbar">
          <input
            aria-label={`Tìm ${config.title}`}
            placeholder="Tìm kiếm…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {data.loading ? (
          <Loading />
        ) : data.data?.length ? (
          <Rows
            rows={data.data}
            columns={config.columns}
            actions={(row) => (
              <>
                <button className="text-link" onClick={() => void view(row)}>
                  Chi tiết
                </button>
                {canWrite && config.path !== "/roles" && (
                  <button className="text-link" onClick={() => setEditing(row)}>
                    Sửa
                  </button>
                )}
                {canWrite && !config.noDelete && (
                  <button
                    className="text-link danger-text"
                    onClick={() => void erase(row)}
                  >
                    Xóa
                  </button>
                )}
              </>
            )}
          />
        ) : (
          <Empty />
        )}
        <Pagination meta={data.meta} page={page} onChange={setPage} />
      </div>
      {editing !== undefined && (
        <ActionForm
          title={`${editing ? "Cập nhật" : "Thêm"} ${config.title.toLowerCase()}`}
          fields={config.fields}
          original={editing ?? undefined}
          close={() => setEditing(undefined)}
          saved={saved}
          onSubmit={(values) =>
            editing
              ? (config.patch ? patch : put)(
                  `${config.path}/${editing.id}`,
                  values,
                )
              : post(config.path, values)
          }
        />
      )}
      {detail && (
        <Modal title={config.title} onClose={() => setDetail(null)} wide>
          <div className="modal-body">
            <Details data={detail} />
          </div>
        </Modal>
      )}
    </section>
  );
}
