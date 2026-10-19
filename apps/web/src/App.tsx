import { useEffect, useState, type FormEvent } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileHeart,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  Stethoscope,
  Users,
  X,
} from "lucide-react";
import {
  api,
  post,
  put,
  restoreSession,
  storeSession,
  type Session,
} from "./api";
import type { MedicalRecord, Notification, User } from "./types";
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
  PageTitle,
  Success,
  usePagedResource,
  useResource,
} from "./ui";
import { PatientPage } from "./patients";
import { RecordsPage, RecordDetail } from "./records";
import { TemplatesPage } from "./templates";
import { AdminPage, FacilitiesPage } from "./admin";
import { NotificationsPage, TrackingPage } from "./tracking";

export default function App() {
  const [session, setSession] = useState<Session | null>(() =>
    restoreSession(),
  );
  useEffect(() => {
    const clear = () => setSession(null);
    window.addEventListener("mayday:unauthorized", clear);
    return () => window.removeEventListener("mayday:unauthorized", clear);
  }, []);
  if (!session)
    return (
      <Login
        onLogin={(value) => {
          storeSession(value);
          setSession(value);
        }}
      />
    );
  return (
    <Workspace
      session={session}
      onLogout={() => {
        storeSession(null);
        setSession(null);
      }}
      onProfile={(user) => {
        const updated = { ...session, user };
        storeSession(updated);
        setSession(updated);
      }}
    />
  );
}
function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const [phone, setPhone] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      onLogin(await post<Session>("/auth/login", { phone, password }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-story">
        <Logo />
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
              <FileHeart size={21} />
              <span>Hồ sơ lâm sàng xuyên suốt</span>
            </div>
            <div>
              <Activity size={21} />
              <span>Theo dõi UAS7 & tổn thương da</span>
            </div>
            <div>
              <ShieldCheck size={21} />
              <span>Truy cập theo vai trò được cấp</span>
            </div>
          </div>
        </div>
        <span className="story-footer">
          MayDay · Đồng hành cùng sức khỏe của bạn
        </span>
        <div className="orb orb-one" />
        <div className="orb orb-two" />
      </div>
      <main className="login-main">
        <div className="login-form">
          <div className="login-icon">
            <Stethoscope size={28} />
          </div>
          <span className="eyebrow">CHÀO MỪNG TRỞ LẠI</span>
          <h2>Đăng nhập MayDay</h2>
          <p>Sử dụng tài khoản được cấp để bắt đầu phiên làm việc.</p>
          <form onSubmit={submit}>
            <Field label="Số điện thoại" required>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="username"
                placeholder="Nhập số điện thoại"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                pattern="[0-9+]{9,15}"
              />
            </Field>
            <Field label="Mật khẩu" required>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </Field>
            <ErrorBox message={error} />
            <Button type="submit" busy={busy}>
              Đăng nhập <ArrowUpRight size={17} />
            </Button>
          </form>
          <div className="login-note">
            <ShieldCheck size={16} />
            Thông tin hồ sơ được bảo vệ theo quyền truy cập.
          </div>
        </div>
        <span className="login-copyright">
          © {new Date().getFullYear()} MayDay. Hệ thống quản lý khám bệnh.
        </span>
      </main>
    </div>
  );
}
function Logo() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <HeartPulse size={24} />
      </span>
      <span>
        MayDay<small>CARE WORKSPACE</small>
      </span>
    </div>
  );
}
function Workspace({
  session,
  onLogout,
  onProfile,
}: {
  session: Session;
  onLogout: () => void;
  onProfile: (u: User) => void;
}) {
  const [menu, setMenu] = useState(false),
    [logoutError, setLogoutError] = useState("");
  const role = userRole(session.user),
    isPatient = role === "patient",
    isAdmin = role === "admin" || role.includes("administrator");
  const notifications = useResource<Notification[]>("/notifications");
  const unread = rows(notifications.data).filter(
    (n) => n.is_read === false || n.is_read === "0",
  ).length;
  const links = [
    { to: "/", label: "Tổng quan", icon: LayoutDashboard },
    ...(!isPatient
      ? [{ to: "/patients", label: "Bệnh nhân", icon: Users }]
      : []),
    { to: "/records", label: "Hồ sơ bệnh án", icon: ClipboardList },
    { to: "/tracking", label: "Theo dõi mề đay", icon: Activity },
    ...(!isPatient
      ? [{ to: "/templates", label: "Mẫu phiếu khám", icon: FileHeart }]
      : []),
  ];
  async function logout() {
    try {
      await post("/auth/logout", {});
      onLogout();
    } catch (e) {
      setLogoutError((e as Error).message);
    }
  }
  return (
    <div className="workspace">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <div className="sidebar-logo">
          <Logo />
          <button
            className="icon-button mobile-only"
            aria-label="Đóng menu"
            onClick={() => setMenu(false)}
          >
            <X size={21} />
          </button>
        </div>
        <div className="workspace-label">KHÔNG GIAN LÀM VIỆC</div>
        <nav>
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setMenu(false)}
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        {isAdmin && (
          <>
            <div className="workspace-label admin-label">QUẢN TRỊ HỆ THỐNG</div>
            <nav>
              <NavLink to="/facilities" onClick={() => setMenu(false)}>
                <Building2 size={19} />
                Cơ sở & phòng khám
              </NavLink>
              <NavLink to="/admin" onClick={() => setMenu(false)}>
                <ShieldCheck size={19} />
                Tài khoản & phân quyền
              </NavLink>
            </nav>
          </>
        )}
        <div className="sidebar-bottom">
          <div className="care-note">
            <div>
              <HeartPulse size={20} />
              <strong>Chăm sóc liên tục</strong>
            </div>
            <p>Mỗi ghi nhận hôm nay giúp hiểu rõ hơn sức khỏe ngày mai.</p>
          </div>
          <NavLink to="/settings">
            <Settings2 size={18} />
            Cài đặt tài khoản
          </NavLink>
          <button onClick={logout}>
            <LogOut size={18} />
            Đăng xuất
          </button>
          <ErrorBox message={logoutError} />
        </div>
      </aside>
      {menu && <div className="sidebar-scrim" onClick={() => setMenu(false)} />}
      <div className="main-column">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-only"
              aria-label="Mở menu"
              onClick={() => setMenu(true)}
            >
              <Menu size={22} />
            </button>
            <span className="connection-dot" />
            <span>
              Không gian{" "}
              {isPatient ? "bệnh nhân" : isAdmin ? "quản trị" : "bác sĩ"}
            </span>
          </div>
          <div className="topbar-right">
            <span className="today">
              <CalendarDays size={16} />
              {date(new Date().toISOString())}
            </span>
            <Link
              className="notification-button"
              to="/notifications"
              aria-label="Thông báo"
            >
              <Bell size={20} />
              {unread > 0 && <span>{unread}</span>}
            </Link>
            <div className="topbar-divider" />
            <Link to="/settings" className="user-chip">
              <div className="avatar">
                {session.user.full_name
                  ?.split(" ")
                  .slice(-2)
                  .map((x) => x[0])
                  .join("") || "MD"}
              </div>
              <div>
                <strong>{session.user.full_name}</strong>
                <small>
                  {isAdmin
                    ? "Quản trị viên"
                    : isPatient
                      ? "Bệnh nhân"
                      : "Bác sĩ / nhân viên y tế"}
                </small>
              </div>
            </Link>
          </div>
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard user={session.user} />} />
            <Route
              path="/patients"
              element={!isPatient ? <PatientPage /> : <Navigate to="/" />}
            />
            <Route
              path="/records"
              element={<RecordsPage user={session.user} />}
            />
            <Route
              path="/records/:id"
              element={<RecordDetail user={session.user} />}
            />
            <Route
              path="/tracking"
              element={<TrackingPage user={session.user} />}
            />
            <Route
              path="/templates"
              element={!isPatient ? <TemplatesPage /> : <Navigate to="/" />}
            />
            <Route
              path="/facilities"
              element={isAdmin ? <FacilitiesPage /> : <Navigate to="/" />}
            />
            <Route
              path="/admin"
              element={isAdmin ? <AdminPage /> : <Navigate to="/" />}
            />
            <Route
              path="/notifications"
              element={<NotificationsPage onChange={notifications.reload} />}
            />
            <Route
              path="/settings"
              element={
                <AccountPage user={session.user} onProfile={onProfile} />
              }
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
          <footer className="page-footer">
            <span>MayDay · Quản lý khám bệnh & theo dõi mề đay</span>
            <span>Chăm sóc bằng sự thấu hiểu</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
function Dashboard({ user }: { user: User }) {
  const isPatient = userRole(user) === "patient",
    records = usePagedResource<MedicalRecord>("/medical_records/all?limit=5");
  const list = rows(records.data);
  const navigate = useNavigate();
  const waiting = usePagedResource<MedicalRecord>(
      "/medical_records/all?limit=1&status=pending",
    ),
    active = usePagedResource<MedicalRecord>(
      "/medical_records/all?limit=1&status=in_progress",
    ),
    finished = usePagedResource<MedicalRecord>(
      "/medical_records/all?limit=1&status=completed",
    );
  const pending =
      waiting.loading || waiting.error ? "—" : (waiting.meta?.total ?? 0),
    progress = active.loading || active.error ? "—" : (active.meta?.total ?? 0),
    completed =
      finished.loading || finished.error ? "—" : (finished.meta?.total ?? 0);
  const today = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <>
      <PageTitle
        eyebrow={today.toUpperCase()}
        title={`Xin chào, ${user.full_name.split(" ").slice(-2).join(" ")} 👋`}
        description="Một góc nhìn rõ ràng cho hành trình chăm sóc hôm nay."
        action={
          <Link className="button primary" to="/records">
            <ClipboardList size={17} />
            Quản lý hồ sơ
          </Link>
        }
      />
      <div className="welcome-banner">
        <div>
          <span className="eyebrow light">CHĂM SÓC CÓ KẾT NỐI</span>
          <h2>
            Mỗi hồ sơ là một hành trình.
            <br />
            Cùng theo dõi, cùng chăm sóc.
          </h2>
          <p>
            Tiếp nhận bệnh án, cập nhật chỉ dẫn và theo dõi tiến triển
            <br className="desktop-only" /> từ một không gian làm việc.
          </p>
          <Link to="/tracking">
            Xem theo dõi mề đay <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="banner-illustration">
          <div className="heartbeat-card">
            <HeartPulse size={55} />
            <span>MAYDAY CARE</span>
          </div>
          <div className="float-check">
            <CheckCircle2 size={20} />
            <span>Chăm sóc liên tục</span>
          </div>
          <div className="banner-ring" />
        </div>
      </div>
      <div className="stats-grid">
        {[
          {
            title: "Tổng hồ sơ",
            value:
              records.loading || records.error
                ? "—"
                : (records.meta?.total ?? 0),
            caption: "Trong phạm vi truy cập",
            Icon: ClipboardList,
            cls: "teal",
          },
          {
            title: "Chờ tiếp nhận",
            value: pending,
            caption: "Cần được bác sĩ tiếp nhận",
            Icon: CalendarDays,
            cls: "amber",
          },
          {
            title: "Đang khám",
            value: progress,
            caption: "Đang theo dõi và điều trị",
            Icon: Stethoscope,
            cls: "blue",
          },
          {
            title: "Hoàn thành",
            value: completed,
            caption: "Đã chốt chỉ dẫn lâm sàng",
            Icon: CheckCircle2,
            cls: "green",
          },
        ].map((stat) => (
          <div className="stat-card" key={stat.title}>
            <div className={`stat-icon ${stat.cls}`}>
              <stat.Icon size={21} />
            </div>
            <div className="stat-title">{stat.title}</div>
            <strong>{stat.value}</strong>
            <small>{stat.caption}</small>
          </div>
        ))}
      </div>
      <ErrorBox message={records.error} />
      <div className="dashboard-grid">
        <Card
          title="Hồ sơ gần đây"
          description="Theo dõi trạng thái của các lượt khám"
          action={
            <Link className="text-link" to="/records">
              Xem tất cả <ArrowUpRight size={15} />
            </Link>
          }
        >
          {records.loading ? (
            <Loading />
          ) : !list.length ? (
            <Empty
              title="Chưa có hồ sơ bệnh án"
              text="Bắt đầu bằng cách tạo hồ sơ khám bệnh đầu tiên."
              action={
                <Link className="button secondary" to="/records">
                  Tạo hồ sơ
                </Link>
              }
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Bệnh nhân</th>
                    <th>Ngày tạo</th>
                    <th>Trạng thái</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.slice(0, 5).map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => navigate(`/records/${r.id}`)}
                      className="clickable"
                    >
                      <td>
                        <strong>{patientName(r.patient)}</strong>
                        <small>HS · {r.id.slice(0, 8).toUpperCase()}</small>
                      </td>
                      <td>{date(r.created_at)}</td>
                      <td>
                        <Badge status={r.status} />
                      </td>
                      <td>
                        <ArrowUpRight size={17} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Truy cập nhanh" description="Tác vụ thường dùng">
          <div className="quick-links">
            {[
              {
                to: "/records",
                title: "Tiếp nhận & khám bệnh",
                text: "Phiếu khám, đơn thuốc, xét nghiệm",
                Icon: Stethoscope,
              },
              {
                to: "/tracking",
                title: "Theo dõi tiến triển",
                text: "Thang điểm UAS7 và tổn thương",
                Icon: Activity,
              },
              {
                to: isPatient ? "/notifications" : "/templates",
                title: isPatient ? "Thông báo chăm sóc" : "Mẫu phiếu khám",
                text: isPatient
                  ? "Cập nhật đơn thuốc và kết quả"
                  : "Cấu trúc biểu mẫu lâm sàng linh hoạt",
                Icon: FileHeart,
              },
            ].map(({ to, title, text, Icon }) => (
              <Link to={to} key={to}>
                <span className="quick-icon">
                  <Icon size={21} />
                </span>
                <div>
                  <strong>{title}</strong>
                  <small>{text}</small>
                </div>
                <ArrowUpRight size={17} />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
function AccountPage({
  user,
  onProfile,
}: {
  user: User;
  onProfile: (u: User) => void;
}) {
  const profile = useResource<User>("/profile"),
    [name, setName] = useState(user.full_name),
    [oldPassword, setOldPassword] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  useEffect(() => {
    if (profile.data) setName(profile.data.full_name || user.full_name);
  }, [profile.data, user.full_name]);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const updated = await put<User>("/profile", { full_name: name });
      onProfile({ ...user, ...updated, full_name: name });
      setSuccess("Đã cập nhật thông tin tài khoản.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await put("/auth/change-password", {
        oldPassword,
        newPassword,
        confirm_password: newPassword,
      });
      setSuccess("Đã đổi mật khẩu. Vui lòng đăng nhập lại.");
      storeSession(null);
      window.dispatchEvent(new Event("mayday:unauthorized"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="TÀI KHOẢN"
        title="Cài đặt tài khoản"
        description="Quản lý thông tin cá nhân và bảo mật phiên truy cập."
      />
      <ErrorBox message={error || profile.error} />
      <Success message={success} />
      <div className="two-columns">
        <Card title="Thông tin cá nhân">
          <form className="card-form" onSubmit={save}>
            <Field label="Họ và tên" required>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field label="Số điện thoại">
              <input value={user.phone} disabled />
            </Field>
            <Button type="submit" busy={busy}>
              Lưu thông tin
            </Button>
          </form>
        </Card>
        <Card title="Đổi mật khẩu" description="Mật khẩu mới tối thiểu 8 ký tự">
          <form className="card-form" onSubmit={changePassword}>
            <Field label="Mật khẩu hiện tại" required>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />
            </Field>
            <Field label="Mật khẩu mới" required>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </Field>
            <Button type="submit" variant="secondary" busy={busy}>
              Đổi mật khẩu
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
