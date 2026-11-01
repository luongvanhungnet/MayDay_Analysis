import { useEffect, useState, type FormEvent } from "react";
import ParallelAI from './ParallelAI';
import {
  Activity,
  FileHeart,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import {
  api,
  patch,
  post,
  remove,
  restoreSession,
  storeSession,
  type Session,
} from "./api";
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
import {
  display,
  formData,
  immutableOnEdit,
  label,
  titles,
  type Column,
  type NativeRow,
  type NativeTable,
} from "./native-model";

export default function NativeApp() {
  const [session, setSession] = useState<Session | null>(() =>
    restoreSession(),
  );
  useEffect(() => {
    const clear = () => setSession(null);
    window.addEventListener("mayday:unauthorized", clear);
    return () => window.removeEventListener("mayday:unauthorized", clear);
  }, []);
  const save = (s: Session | null) => {
    storeSession(s);
    setSession(s);
  };
  return session ? (
    <Workspace session={session} logout={() => save(null)} />
  ) : (
    <Login saved={save} />
  );
}
function Login({ saved }: { saved: (s: Session) => void }) {
  const [identifier, setIdentifier] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      saved(await post<Session>("/auth/login", { identifier, password }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-story">
        <div className="native-brand">
          <FileHeart /> MayDay
        </div>
        <div className="login-copy">
          <span className="eyebrow light">KHÔNG GIAN CHĂM SÓC CHUYÊN SÂU</span>
          <h1>
            Chăm sóc tốt hơn.
            <br />
            <span>Mỗi ngày.</span>
          </h1>
          <p>
            Kết nối hành trình khám bệnh, điều trị và theo dõi mề đay trong một
            không gian thống nhất.
          </p>
          <div className="login-features">
            <div>
              <Stethoscope />
              <span>Hồ sơ và phiên khám cấp / mạn</span>
            </div>
            <div>
              <Activity />
              <span>Theo dõi UAS7 và tổn thương da</span>
            </div>
            <div>
              <ShieldCheck />
              <span>Truy cập theo vai trò tài khoản</span>
            </div>
          </div>
        </div>
      </div>
      <div className="native-login">
        <form onSubmit={submit}>
          <span className="eyebrow">CHÀO MỪNG TRỞ LẠI</span>
          <h1>Đăng nhập MayDay</h1>
          <p className="muted">Sử dụng tài khoản đã được cấp để tiếp tục.</p>
          <Field label="Tên đăng nhập hoặc số điện thoại" required>
            <input
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoFocus
            />
          </Field>
          <Field label="Mật khẩu" required>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <ErrorBox message={error} />
          <Button type="submit" busy={busy}>
            Đăng nhập
          </Button>
        </form>
      </div>
    </div>
  );
}
function Workspace({
  session,
  logout,
}: {
  session: Session;
  logout: () => void;
}) {
  const schema = useResource<NativeTable[]>("/data/schema");
  const [name, setName] = useState(
    () => new URLSearchParams(location.search).get("table") || "hosobenhan",
  );
  const [navSearch, setNavSearch] = useState(""),
    [password, setPassword] = useState(false),
    [error, setError] = useState("");
  const selected =
    schema.data?.find((t) => t.name === name) ?? schema.data?.[0];
  function navigate(next: string) {
    setName(next);
    history.replaceState(null, "", `?table=${next}`);
  }
  async function signout() {
    try {
      await post("/auth/logout", {});
      logout();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="native-shell">
      <aside className="native-sidebar">
        <div className="native-brand">
          <FileHeart /> MayDay
        </div>
        <span className="eyebrow">QUẢN LÝ CHĂM SÓC</span>
        <div className="search-box">
          <Search size={16} />
          <input
            aria-label="Tìm chức năng"
            placeholder="Tìm chức năng…"
            value={navSearch}
            onChange={(e) => setNavSearch(e.target.value)}
          />
        </div>
        <nav>
          <button className={name === 'ai' ? 'active' : ''} onClick={() => navigate('ai')}>Phân tích ảnh AI</button>
          {schema.data
            ?.filter((t) =>
              titles[t.name]
                ?.toLocaleLowerCase("vi")
                .includes(navSearch.toLocaleLowerCase("vi")),
            )
            .map((t) => (
              <button
                className={name !== 'ai' && selected?.name === t.name ? "active" : ""}
                key={t.name}
                onClick={() => navigate(t.name)}
              >
                {titles[t.name] || t.name}
              </button>
            ))}
        </nav>
        <div className="native-account">
          <strong>{session.user.full_name}</strong>
          <small>{display(session.user.role)}</small>
          <button onClick={() => setPassword(true)}>Đổi mật khẩu</button>
          <button onClick={() => void signout()}>
            <LogOut size={15} /> Đăng xuất
          </button>
          <ErrorBox message={error} />
        </div>
      </aside>
      <main className="native-main">
        <header className="native-topbar">
          <span>MayDay / Chăm sóc mề đay</span>
          <span>{new Date().toLocaleDateString("vi-VN")}</span>
        </header>
        {name === 'ai' ? <ParallelAI /> : schema.loading ? (
          <Loading />
        ) : schema.error ? (
          <ErrorBox message={schema.error} />
        ) : selected ? (
          <DataPage
            key={selected.name}
            table={selected}
            allTables={schema.data!}
          />
        ) : (
          <Empty />
        )}
      </main>
      {password && (
        <PasswordModal close={() => setPassword(false)} saved={logout} />
      )}
    </div>
  );
}
function DataPage({
  table: t,
  allTables,
}: {
  table: NativeTable;
  allTables: NativeTable[];
}) {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [editing, setEditing] = useState<NativeRow | null | undefined>(),
    [patient, setPatient] = useState(false),
    [success, setSuccess] = useState(""),
    [error, setError] = useState(""),
    [filter, setFilter] = useState<Record<string, string>>({});
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const data = usePagedResource<NativeRow>(
    `/data/${t.name}?page=${page}&search=${encodeURIComponent(query)}&filter=${encodeURIComponent(JSON.stringify(filter))}`,
  );
  const visible = t.columns
    .filter(
      (c) =>
        !c.generated &&
        !["thoi_diem_tao", "thoi_diem_cap_nhat"].includes(c.name),
    )
    .slice(0, 7);
  const saved = () => {
    setEditing(undefined);
    setPatient(false);
    setSuccess("Đã lưu dữ liệu.");
    data.reload();
  };
  async function erase(row: NativeRow) {
    if (!confirm("Xóa mục danh mục này?")) return;
    try {
      await remove(`/data/${t.name}/${encodeURIComponent(row._key)}`);
      data.reload();
      setSuccess("Đã xóa mục danh mục.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="native-content">
      <div className="page-title">
        <div>
          <span className="eyebrow">HỒ SƠ & ĐIỀU TRỊ</span>
          <h1>{titles[t.name]}</h1>
          <p className="muted">{data.meta?.total ?? "—"} bản ghi</p>
        </div>
        <div className="native-actions">
          {t.name === "benhnhan" && t.can_write && (
            <Button onClick={() => setPatient(true)}>
              <Plus size={16} /> Tiếp nhận bệnh nhân
            </Button>
          )}
          {t.can_create && (
            <Button onClick={() => setEditing(null)}>
              <Plus size={16} /> Thêm mới
            </Button>
          )}
        </div>
      </div>
      <Success message={success} />
      <ErrorBox message={error} />
      <div className="card">
        <div className="native-toolbar">
          <div className="search-box">
            <Search size={18} />
            <input
              placeholder="Tìm kiếm…"
              aria-label="Tìm kiếm dữ liệu"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <details>
            <summary>Lọc dữ liệu</summary>
            <div className="native-filter">
              {t.columns
                .filter(
                  (c) =>
                    c.pk || t.relations.some((r) => r.columns.includes(c.name)),
                )
                .map((c) => (
                  <Field key={c.name} label={label(c.name)}>
                    <input
                      value={filter[c.name] ?? ""}
                      onChange={(e) => {
                        setFilter((current) => {
                          const next = { ...current };
                          if (e.target.value) next[c.name] = e.target.value;
                          else delete next[c.name];
                          return next;
                        });
                        setPage(1);
                      }}
                    />
                  </Field>
                ))}
            </div>
          </details>
        </div>
        <ErrorBox message={data.error} />
        {data.loading ? (
          <Loading />
        ) : !data.data?.length ? (
          <Empty title="Chưa có bản ghi" />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {["benhnhan", "nhanvien", "hosobenhan", "phienkham"].includes(
                    t.name,
                  ) && <th>Thông tin</th>}
                  {visible.map((c) => (
                    <th key={c.name}>{label(c.name)}</th>
                  ))}
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((row) => (
                  <tr key={row._key}>
                    {[
                      "benhnhan",
                      "nhanvien",
                      "hosobenhan",
                      "phienkham",
                    ].includes(t.name) && <td>{display(row._label)}</td>}
                    {visible.map((c) => (
                      <td key={c.name}>
                        <span
                          className="native-cell"
                          title={display(row[c.name])}
                        >
                          {display(row[c.name])}
                        </span>
                      </td>
                    ))}
                    <td>
                      <button
                        className="text-link"
                        onClick={() => setEditing(row)}
                      >
                        {t.can_write ? "Xem / sửa" : "Xem chi tiết"}
                      </button>
                      {t.can_delete && (
                        <button
                          className="text-link danger-text"
                          onClick={() => void erase(row)}
                        >
                          {" "}
                          Xóa
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination meta={data.meta} page={page} onChange={setPage} />
      </div>
      {editing !== undefined && (
        <Editor
          table={t}
          allTables={allTables}
          row={editing}
          close={() => setEditing(undefined)}
          saved={saved}
        />
      )}{" "}
      {patient && (
        <PatientModal
          allTables={allTables}
          close={() => setPatient(false)}
          saved={saved}
        />
      )}
    </section>
  );
}
function Editor({
  table: t,
  allTables,
  row,
  close,
  saved,
}: {
  table: NativeTable;
  allTables: NativeTable[];
  row: NativeRow | null;
  close: () => void;
  saved: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const change = (name: string, value: string) =>
    setDraft((d) => ({ ...d, [name]: value }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const input = formData(t, draft, row);
      if (row)
        await patch(`/data/${t.name}/${encodeURIComponent(row._key)}`, input);
      else await post(`/data/${t.name}`, input);
      saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const columns = row ? t.columns : t.columns.filter((c) => c.writable);
  return (
    <Modal
      title={`${row ? "Chi tiết" : "Thêm mới"} · ${titles[t.name]}`}
      onClose={close}
      wide
    >
      <form onSubmit={submit}>
        <div className="modal-body">
          <div className="form-grid">
            {columns.map((c) => (
              <NativeField
                key={c.name}
                column={c}
                table={t}
                allTables={allTables}
                value={
                  draft[c.name] ??
                  (row?.[c.name] === null ? "" : String(row?.[c.name] ?? ""))
                }
                change={(v) => change(c.name, v)}
                disabled={
                  !t.can_write ||
                  !c.writable ||
                  (!!row && (c.pk || immutableOnEdit.has(c.name)))
                }
                creating={!row}
              />
            ))}
            {t.name === "taikhoan" && t.can_write && (
              <Field
                label={
                  row ? "Mật khẩu mới (để trống nếu giữ nguyên)" : "Mật khẩu"
                }
                required={!row}
              >
                <input
                  type="password"
                  minLength={10}
                  maxLength={72}
                  autoComplete="new-password"
                  required={!row}
                  value={draft.password ?? ""}
                  onChange={(e) => change("password", e.target.value)}
                />
              </Field>
            )}
          </div>
          <ErrorBox message={error} />
        </div>
        <div className="modal-footer">
          <Button type="button" variant="secondary" onClick={close}>
            Đóng
          </Button>
          {t.can_write && (
            <Button type="submit" busy={busy}>
              Lưu dữ liệu
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
function NativeField({
  column: c,
  table: t,
  allTables,
  value,
  change,
  disabled,
  creating,
}: {
  column: Column;
  table: NativeTable;
  allTables: NativeTable[];
  value: string;
  change: (v: string) => void;
  disabled: boolean;
  creating: boolean;
}) {
  const relation = t.relations.find(
    (r) =>
      r.columns.length === 1 &&
      r.columns[0] === c.name &&
      allTables.some((t) => t.name === r.table),
  );
  const required =
    creating && !c.nullable && !c.default && !c.identity && !c.generated;
  let input;
  if (disabled) input = <input disabled value={value || "—"} />;
  else if (relation)
    input = (
      <Reference
        table={relation.table}
        column={relation.references[0]}
        value={value}
        change={change}
        required={required}
      />
    );
  else if (c.type === "boolean" || c.options.length)
    input = (
      <select
        value={value}
        onChange={(e) => change(e.target.value)}
        required={required}
      >
        <option value="">{c.default ? "Giá trị mặc định" : "Chưa chọn"}</option>
        {(c.type === "boolean" ? ["true", "false"] : c.options).map((o) => (
          <option key={o} value={o}>
            {o === "true" ? "Có" : o === "false" ? "Không" : o}
          </option>
        ))}
      </select>
    );
  else if (c.type === "text")
    input = (
      <textarea
        rows={2}
        required={required}
        value={value}
        onChange={(e) => change(e.target.value)}
      />
    );
  else
    input = (
      <input
        required={required}
        type={
          c.type === "date"
            ? "date"
            : c.type.startsWith("timestamp")
              ? "datetime-local"
              : /^(numeric|integer|smallint)/.test(c.type)
                ? "number"
                : "text"
        }
        step="any"
        value={
          c.type === "date"
            ? value.slice(0, 10)
            : c.type.startsWith("timestamp")
              ? value.replace("Z", "").slice(0, 16)
              : value
        }
        onChange={(e) => change(e.target.value)}
        maxLength={Number(c.type.match(/varying\((\d+)\)/)?.[1]) || undefined}
      />
    );
  return (
    <Field
      label={label(c.name)}
      hint={c.generated ? "Tự tính từ dữ liệu đã ghi nhận" : undefined}
      required={required}
    >
      {input}
    </Field>
  );
}
function Reference({
  table,
  column,
  value,
  change,
  required,
}: {
  table: string;
  column: string;
  value: string;
  change: (v: string) => void;
  required: boolean;
}) {
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState("");
  useEffect(() => {
    const timeout = setTimeout(() => setQuery(search), 250);
    return () => clearTimeout(timeout);
  }, [search]);
  const data = useResource<NativeRow[]>(
    `/data/${table}?limit=100&search=${encodeURIComponent(query)}`,
  );
  return (
    <div>
      <input
        aria-label={`Tìm ${titles[table]}`}
        placeholder={`Tìm ${titles[table]?.toLowerCase()}…`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <select
        required={required}
        value={value}
        onChange={(e) => change(e.target.value)}
      >
        <option value="">Chọn {titles[table]?.toLowerCase()}</option>
        {value && !data.data?.some((r) => String(r[column]) === value) && (
          <option value={value}>#{value}</option>
        )}
        {data.data?.map((r) => (
          <option key={r._key} value={String(r[column])}>
            {String(r[column])} ·{" "}
            {display(
              r._label ||
                r.ho_ten ||
                r.ten_thuoc ||
                r.ten_chi_nhanh ||
                r.ten_khoa_phong ||
                r.ten_phong_kham ||
                r.ten_hien_thi ||
                r.ten_dang_nhap ||
                r.ma_benh_nhan ||
                r.ma_ho_so ||
                r.ngay_kham ||
                r.vi_tri_co_the ||
                "",
            )}
          </option>
        ))}
      </select>
      <ErrorBox message={data.error} />
    </div>
  );
}
function PatientModal({
  allTables,
  close,
  saved,
}: {
  allTables: NativeTable[];
  close: () => void;
  saved: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const person = allTables.find((t) => t.name === "nguoi")!,
    patient = allTables.find((t) => t.name === "benhnhan")!;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("/data/patients", {
        person: formData(person, draft, null),
        patient: formData(patient, draft, null),
      });
      saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Tiếp nhận bệnh nhân" onClose={close} wide>
      <form onSubmit={submit}>
        <div className="modal-body">
          <div className="form-grid">
            {[person, patient].flatMap((t) =>
              t.columns
                .filter((c) => c.writable && !c.pk)
                .map((c) => (
                  <NativeField
                    key={c.name}
                    column={c}
                    table={t}
                    allTables={allTables}
                    value={draft[c.name] ?? ""}
                    change={(v) => setDraft((d) => ({ ...d, [c.name]: v }))}
                    disabled={false}
                    creating
                  />
                )),
            )}
          </div>
          <ErrorBox message={error} />
        </div>
        <div className="modal-footer">
          <Button type="button" variant="secondary" onClick={close}>
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
function PasswordModal({
  close,
  saved,
}: {
  close: () => void;
  saved: () => void;
}) {
  const [oldPassword, setOld] = useState(""),
    [password, setPassword] = useState(""),
    [confirmPassword, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Mật khẩu nhập lại không khớp");
      return;
    }
    setBusy(true);
    try {
      await post("/auth/change-password", {
        old_password: oldPassword,
        new_password: password,
      });
      saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Đổi mật khẩu" onClose={close}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <Field label="Mật khẩu hiện tại">
            <input
              type="password"
              autoComplete="current-password"
              required
              value={oldPassword}
              onChange={(e) => setOld(e.target.value)}
            />
          </Field>
          <Field label="Mật khẩu mới">
            <input
              type="password"
              autoComplete="new-password"
              minLength={10}
              maxLength={72}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Nhập lại mật khẩu mới">
            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <ErrorBox message={error} />
        </div>
        <div className="modal-footer">
          <Button type="submit" busy={busy}>
            Lưu và đăng nhập lại
          </Button>
        </div>
      </form>
    </Modal>
  );
}
