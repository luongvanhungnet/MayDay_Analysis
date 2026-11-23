import { useEffect, useState, type FormEvent } from "react";
import {
  canLeave,
  careLink,
  follow,
  go,
  useLocationSearch,
  useUrlState,
  useUnsavedChanges,
} from "./navigation";
import ParallelAI from "./ParallelAI";
import CarePage from "./CarePage";
import { Signup } from "./care-account";
import { availableMenus, initialPage } from "./care-model";
import { ConfirmHost, confirmAction } from "./confirmation";
import {
  Activity,
  CalendarDays,
  Camera,
  ClipboardList,
  Eye,
  EyeOff,
  FileHeart,
  FlaskConical,
  FolderOpen,
  Hospital,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  api,
  patch,
  post,
  put,
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

const workspaceIcons: Partial<Record<string, typeof FileHeart>> = {
  today: LayoutDashboard,
  overview: LayoutDashboard,
  records: ClipboardList,
  patients: Users,
  uas: Activity,
  lesions: Camera,
  media: FolderOpen,
  profile: UserRound,
  users: Users,
  roles: ShieldCheck,
  permissions: ShieldCheck,
  grants: ShieldCheck,
  branches: Hospital,
  departments: Hospital,
  rooms: Stethoscope,
};

export default function NativeApp() {
  const [session, setSession] = useState<Session | null>(() =>
    restoreSession(),
  );
  useEffect(() => {
    const clear = () => setSession(null);
    const profile = () => setSession(restoreSession());
    window.addEventListener("mayday:unauthorized", clear);
    window.addEventListener("mayday:profile", profile);
    return () => {
      window.removeEventListener("mayday:unauthorized", clear);
      window.removeEventListener("mayday:profile", profile);
    };
  }, []);
  const save = (s: Session | null) => {
    storeSession(s);
    setSession(s);
  };
  return (
    <>
      {session ? (
        <Workspace session={session} logout={() => save(null)} />
      ) : (
        <Login saved={save} />
      )}
      <ConfirmHost />
    </>
  );
}
function Login({ saved }: { saved: (s: Session) => void }) {
  const [signup, setSignup] = useState(false),
    [registered, setRegistered] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="login-page mayday-login">
      <div className="login-story">
        <div className="native-brand">
          <span className="brand-symbol"><FileHeart size={24} aria-hidden="true" /></span>
          MayDay
        </div>
        <div className="login-copy">
          <h2>Quản lý và theo dõi mề đay</h2>
          <p>
            Tra cứu hồ sơ khám, ghi nhật ký triệu chứng và theo dõi ảnh tổn thương.
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
          </div>
        </div>
      </div>
      <main className="native-login">
        <form onSubmit={submit}>
          <h1>Đăng nhập MayDay</h1>
          <Field label="Tên đăng nhập hoặc số điện thoại" required>
            <input
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </Field>
          <div className="field">
            <label htmlFor="login-password">Mật khẩu <em>*</em></label>
            <span className="password-entry">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </span>
          </div>
          <ErrorBox message={error} />
          <Success
            message={
              registered
                ? "Đã tạo tài khoản. Đăng nhập bằng số điện thoại và mật khẩu vừa chọn."
                : ""
            }
          />
          <Button type="submit" busy={busy}>
            Đăng nhập
          </Button>
          <button
            type="button"
            className="text-link"
            onClick={() => setSignup(true)}
          >
            Chưa có tài khoản? Đăng ký bệnh nhân
          </button>
          <small className="muted">
            Quên mật khẩu? Vui lòng liên hệ quản trị viên cơ sở khám.
          </small>
        </form>
      </main>
      {signup && (
        <Signup
          close={() => setSignup(false)}
          saved={() => {
            setSignup(false);
            setRegistered(true);
          }}
        />
      )}
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
  const search = useLocationSearch();
  const defaultView =
    session.user.role === "benh_nhan"
      ? "today"
      : session.user.role === "admin"
        ? "overview"
        : session.user.role === "dieu_duong"
          ? "patients"
          : "records";
  const name = search ? initialPage(search) : `care:${defaultView}`;
  const [navSearch, setNavSearch] = useState(""),
    [mobileNav, setMobileNav] = useState(false),
    [password, setPassword] = useState(false),
    [error, setError] = useState("");
  const selected = schema.data?.find((t) => t.name === name);
  function navigate(next: string) {
    void go(
      next.startsWith("care:")
        ? careLink(next.slice(5))
        : `?table=${encodeURIComponent(next)}`,
    ).then(() => setMobileNav(false));
  }
  async function signout() {
    if (!(await canLeave())) return;
    try {
      await post("/auth/logout", {});
      logout();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="native-shell">
      <aside className="native-sidebar" data-mobile-open={mobileNav}>
        <button
          type="button"
          className="native-brand workspace-brand"
          onClick={() => navigate(`care:${defaultView}`)}
        >
          <span className="brand-symbol"><FileHeart size={22} aria-hidden="true" /></span> MayDay
        </button>
        <button
          className="mobile-nav-toggle"
          aria-expanded={mobileNav}
          aria-controls="workspace-navigation"
          onClick={() => setMobileNav((v) => !v)}
        >
          {mobileNav ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          {mobileNav ? "Đóng menu" : "Menu"}
        </button>
        <div className="search-box">
          <Search size={16} />
          <input
            aria-label="Tìm chức năng"
            placeholder="Tìm chức năng…"
            value={navSearch}
            onChange={(e) => setNavSearch(e.target.value)}
          />
        </div>
        <nav id="workspace-navigation" aria-label="Chức năng MayDay">
          {availableMenus(session.user.role)
            .filter((m) =>
              m.title
                .toLocaleLowerCase("vi")
                .includes(navSearch.toLocaleLowerCase("vi")),
            )
            .reduce<
              { group: string; items: ReturnType<typeof availableMenus> }[]
            >((groups, item) => {
              const group = groups.find((g) => g.group === item.group);
              if (group) group.items.push(item);
              else groups.push({ group: item.group, items: [item] });
              return groups;
            }, [])
            .map(({ group, items }) => (
              <details
                key={group}
                open={
                  !!navSearch ||
                  items.some((m) => name === `care:${m.id}`) ||
                  !["QUẢN TRỊ", "CƠ SỞ"].includes(group)
                }
                className="care-nav-group"
              >
                <summary>
                  {group === "CƠ SỞ"
                    ? "Cơ sở khám"
                    : group === "QUẢN TRỊ"
                      ? "Quản trị"
                      : group}
                </summary>
                {items.map((m) => {
                  const Icon = workspaceIcons[m.id] ?? FolderOpen;
                  return (
                    <button
                      key={m.id}
                      aria-current={name === `care:${m.id}` ? "page" : undefined}
                      className={name === `care:${m.id}` ? "active" : ""}
                      onClick={() => navigate(`care:${m.id}`)}
                    >
                      <Icon size={17} aria-hidden="true" />
                      <span>{m.title}</span>
                    </button>
                  );
                })}
              </details>
            ))}
          <button
            className={name === "ai" ? "active" : ""}
            aria-current={name === "ai" ? "page" : undefined}
            onClick={() => navigate("ai")}
          >
            <FlaskConical size={17} aria-hidden="true" />
            Phân tích ảnh AI
          </button>
          {session.user.role !== "benh_nhan" && (
            <details className="care-advanced">
              <summary>Hồ sơ chuyên sâu</summary>
              {schema.data
                ?.filter(
                  (t) =>
                    ![
                      "nguoi",
                      "benhnhan",
                      "hosobenhan",
                      "dottonthuongda",
                      "vitritonthuong",
                      "anhchuptonthuong",
                      "nhatkyuashangngay",
                      "tepdinhkem",
                      "chinhanh",
                      "khoaphong",
                      "phongkham",
                      "taikhoan",
                      "vaitro",
                      "quyenhan",
                      "vaitroquyenhan",
                    ].includes(t.name),
                )
                ?.filter((t) =>
                  titles[t.name]
                    ?.toLocaleLowerCase("vi")
                    .includes(navSearch.toLocaleLowerCase("vi")),
                )
                .map((t) => (
                  <button
                    className={
                      !name.startsWith("care:") &&
                      name !== "ai" &&
                      selected?.name === t.name
                        ? "active"
                        : ""
                    }
                    key={t.name}
                    onClick={() => navigate(t.name)}
                  >
                    {titles[t.name] || t.name}
                  </button>
                ))}
            </details>
          )}
        </nav>
        <div className="native-account">
          <div className="account-identity">
            <span className="account-avatar">
              <UserRound size={19} aria-hidden="true" />
            </span>
            <div>
              <strong>{session.user.full_name}</strong>
              <small>
                {{
                  admin: "Quản trị viên",
                  bac_si: "Bác sĩ",
                  dieu_duong: "Điều dưỡng",
                  benh_nhan: "Bệnh nhân",
                }[session.user.role] ?? session.user.role}
              </small>
            </div>
          </div>
          <button onClick={() => setPassword(true)}>Đổi mật khẩu</button>
          <button onClick={() => void signout()}>
            <LogOut size={15} /> Đăng xuất
          </button>
          <ErrorBox message={error} />
        </div>
      </aside>
      <main className="native-main">
        <header className="native-topbar">
          <span>
            <a href={careLink(defaultView)} onClick={follow}>
              MayDay
            </a>{" "}
            /{" "}
            {availableMenus(session.user.role).find(
              (m) => `care:${m.id}` === name,
            )?.title ??
              titles[name] ??
              (name === "ai" ? "Phân tích ảnh AI" : "Chăm sóc mề đay")}
          </span>
          <span className="workspace-date">
            <CalendarDays size={16} aria-hidden="true" />
            {new Date().toLocaleDateString("vi-VN")}
          </span>
        </header>
        {name.startsWith("care:") ? (
          <CarePage key={name} page={name.slice(5)} session={session} />
        ) : name === "ai" ? (
          <ParallelAI />
        ) : schema.loading ? (
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
          <Empty title="Không tìm thấy trang hoặc bạn không có quyền truy cập" />
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
  const [page, setPage] = useUrlState("page", 1),
    [search, setSearch] = useUrlState("search", ""),
    [query, setQuery] = useState(search),
    [editing, setEditing] = useState<NativeRow | null | undefined>(),
    [patient, setPatient] = useState(false),
    [success, setSuccess] = useState(""),
    [error, setError] = useState(""),
    [filterJson, setFilterJson] = useUrlState("filter", "{}");
  let filter: Record<string, string> = {};
  try {
    const parsed: unknown = JSON.parse(filterJson);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      filter = Object.fromEntries(
        Object.entries(parsed).filter(([, v]) => typeof v === "string"),
      );
  } catch {
    /* Invalid bookmark filters are ignored. */
  }
  const returnRecord = new URLSearchParams(useLocationSearch()).get(
    "return_record",
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
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
    if (!(await confirmAction("Xóa mục danh mục này?"))) return;
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
      {returnRecord && (
        <a
          href={careLink("records", { record: returnRecord })}
          onClick={follow}
        >
          ← Trở về hồ sơ #{returnRecord}
        </a>
      )}
      <ErrorBox message={error} />
      <div className="card">
        <div className="native-toolbar">
          <div className="search-box">
            <Search size={18} />
            <input
              placeholder="Tìm kiếm…"
              aria-label="Tìm kiếm dữ liệu"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
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
                        {
                          const next = { ...filter };
                          if (e.target.value) next[c.name] = e.target.value;
                          else delete next[c.name];
                          setFilterJson(JSON.stringify(next));
                        }
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
  const { allowLeave, markSaved } = useUnsavedChanges(
    busy ||
      Object.entries(draft).some(
        ([name, value]) => value !== String(row?.[name] ?? ""),
      ),
  );
  const cancel = async () => {
    if (!busy && (await allowLeave())) close();
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const input = formData(t, draft, row);
      if (row)
        await patch(`/data/${t.name}/${encodeURIComponent(row._key)}`, input);
      else await post(`/data/${t.name}`, input);
      markSaved();
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
      onClose={() => void cancel()}
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
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void cancel()}
          >
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
  const { allowLeave, markSaved } = useUnsavedChanges(
    busy || !!oldPassword || !!password || !!confirmPassword,
  );
  const cancel = async () => {
    if (!busy && (await allowLeave())) close();
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Mật khẩu nhập lại không khớp");
      return;
    }
    setBusy(true);
    try {
      await put("/auth/change-password", {
        old_password: oldPassword,
        new_password: password,
      });
      markSaved();
      saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Đổi mật khẩu" onClose={() => void cancel()}>
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
