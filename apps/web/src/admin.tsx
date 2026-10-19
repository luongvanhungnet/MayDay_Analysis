import { useEffect, useState, type FormEvent } from "react";
import {
  Building2,
  ChevronRight,
  DoorOpen,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { api, post, put, remove } from "./api";
import type { Facility, Permission, Role, User } from "./types";
import { rows, userRole } from "./types";
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  Field,
  Loading,
  Modal,
  PageTitle,
  Pagination,
  SearchBox,
  Success,
  useResource,
  usePagedResource,
} from "./ui";

export function AdminPage() {
  const [tab, setTab] = useState("users"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [modal, setModal] = useState<"user" | "role" | "permission" | null>(null),
    [editUser, setEditUser] = useState<User | null>(null),
    [editRole, setEditRole] = useState<Role | null>(null),
    [editPermission, setEditPermission] = useState<Permission | null>(null),
    [deleting, setDeleting] = useState<{ name: string; path: string } | null>(
      null,
    ),
    [deleteBusy, setDeleteBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const users = usePagedResource<User>(
      `/admin/users?limit=25&page=${page}&search=${encodeURIComponent(search)}`,
    ),
    roles = useResource<Role[]>("/roles"),
    permissions = useResource<Permission[]>("/permissions");
  const saved = () => {
    setModal(null);
    setEditUser(null);
    setEditPermission(null);
    users.reload();
    roles.reload();
    permissions.reload();
    setSuccess("Đã cập nhật dữ liệu quản trị.");
  };
  async function doDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setError("");
    try {
      await remove(deleting.path);
      setDeleting(null);
      saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleteBusy(false);
    }
  }
  async function toggle(user: User) {
    setError("");
    try {
      await put(`/admin/users/${user.id}`, { is_active: !user.is_active });
      users.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="QUẢN TRỊ HỆ THỐNG"
        title="Tài khoản & phân quyền"
        description="Quản lý nhân sự và quyền truy cập theo vai trò."
        action={
          tab !== "endpoints" && (
            <Button
              onClick={() =>
                setModal(
                  tab === "users"
                    ? "user"
                    : tab === "roles"
                      ? "role"
                      : "permission",
                )
              }
            >
              <Plus size={18} />
              {tab === "users"
                ? "Tạo tài khoản"
                : tab === "roles"
                  ? "Thêm vai trò"
                  : "Thêm quyền"}
            </Button>
          )
        }
      />
      <ErrorBox message={error} />
      <Success message={success} />
      <div className="tabs page-tabs">
        {[
          { key: "users", label: "Tài khoản" },
          { key: "roles", label: "Vai trò & quyền" },
          { key: "permissions", label: "Danh mục quyền" },
          { key: "endpoints", label: "Quyền API" },
        ].map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "active" : ""}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "users" && (
        <Card>
          <div className="list-toolbar">
            <SearchBox
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
            />
            <span className="count-label">
              <Users size={16} />
              {users.meta?.total ?? rows(users.data).length} tài khoản
            </span>
          </div>
          <ErrorBox message={users.error} />
          {users.loading ? (
            <Loading />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Họ tên</th>
                    <th>Số điện thoại</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {rows(users.data).map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.full_name}</strong>
                        <small>{user.id.slice(0, 8).toUpperCase()}</small>
                      </td>
                      <td>{user.phone}</td>
                      <td>
                        <span className="role-label">{userRole(user)}</span>
                      </td>
                      <td>
                        <Badge
                          status={user.is_active ? "active" : "inactive"}
                        />
                      </td>
                      <td>
                        <div className="actions">
                          <button
                            className="icon-button"
                            onClick={() => setEditUser(user)}
                            aria-label="Sửa tài khoản"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="icon-button danger-text"
                            aria-label="Xóa tài khoản"
                            onClick={() =>
                              setDeleting({
                                name: user.full_name,
                                path: `/admin/users/${user.id}`,
                              })
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                          <button
                            className="text-link"
                            onClick={() => void toggle(user)}
                          >
                            {user.is_active ? "Khóa" : "Mở khóa"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination meta={users.meta} page={page} onChange={setPage} />
        </Card>
      )}
      {tab === "roles" && (
        <Card
          title="Vai trò được cấp"
          description="Mỗi vai trò được gán các quyền truy cập nghiệp vụ"
        >
          <ErrorBox message={roles.error} />
          {roles.loading ? (
            <Loading />
          ) : (
            <div className="role-grid">
              {rows(roles.data).map((role) => (
                <button
                  className="role-card"
                  key={role.id}
                  onClick={() => setEditRole(role)}
                >
                  <span className="role-icon">
                    <ShieldCheck size={23} />
                  </span>
                  <div>
                    <strong>{role.name}</strong>
                    <small>{role.code}</small>
                    <p>
                      {role.description || "Nhấn để quản lý quyền được cấp"}
                    </p>
                  </div>
                  <ChevronRight size={17} />
                </button>
              ))}
            </div>
          )}
        </Card>
      )}
      {tab === "permissions" && (
        <Card title="Danh mục quyền nghiệp vụ">
          <ErrorBox message={permissions.error} />
          {permissions.loading ? (
            <Loading />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tên quyền</th>
                    <th>Mã quyền</th>
                    <th>Mô tả</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {rows(permissions.data).map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                      </td>
                      <td>
                        <code>{p.code}</code>
                      </td>
                      <td>{p.description || "—"}</td>
                      <td>
                        <div className="actions">
                          <button
                            className="icon-button"
                            aria-label="Sửa quyền"
                            onClick={() => setEditPermission(p)}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="icon-button danger-text"
                            aria-label="Xóa quyền"
                            onClick={() =>
                              setDeleting({
                                name: p.name,
                                path: `/permissions/${p.id}`,
                              })
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      {tab === "endpoints" && (
        <EndpointsTab permissions={rows(permissions.data)} />
      )}
      {editPermission && (
        <NamedModal
          type="permissions"
          entity={editPermission}
          onClose={() => setEditPermission(null)}
          onSaved={saved}
        />
      )}
      {deleting && (
        <Modal title="Xóa dữ liệu quản trị" onClose={() => setDeleting(null)}>
          <div className="modal-body">
            <p>
              Xóa <strong>{deleting.name}</strong>? Dữ liệu y tế liên quan được
              máy chủ kiểm tra trước khi thực hiện.
            </p>
            <ErrorBox message={error} />
          </div>
          <div className="modal-footer">
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Hủy
            </Button>
            <Button variant="danger" busy={deleteBusy} onClick={doDelete}>
              Xóa
            </Button>
          </div>
        </Modal>
      )}
      {modal === "user" && (
        <UserModal
          roles={rows(roles.data)}
          onClose={() => setModal(null)}
          onSaved={saved}
        />
      )}{" "}
      {editUser && (
        <UserModal
          user={editUser}
          roles={rows(roles.data)}
          onClose={() => setEditUser(null)}
          onSaved={saved}
        />
      )}{" "}
      {modal === "role" && (
        <NamedModal
          type="roles"
          onClose={() => setModal(null)}
          onSaved={saved}
        />
      )}{" "}
      {modal === "permission" && (
        <NamedModal
          type="permissions"
          onClose={() => setModal(null)}
          onSaved={saved}
        />
      )}{" "}
      {editRole && (
        <RolePermissionsModal
          role={editRole}
          permissions={rows(permissions.data)}
          onClose={() => setEditRole(null)}
          onSaved={() => {
            setEditRole(null);
            roles.reload();
          }}
        />
      )}
    </>
  );
}
function UserModal({
  user,
  roles,
  onClose,
  onSaved,
}: {
  user?: User;
  roles: Role[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(user?.full_name || ""),
    [phone, setPhone] = useState(user?.phone || ""),
    [password, setPassword] = useState(""),
    [role, setRole] = useState(user?.role_id || user?.staff?.role?.id || ""),
    [branch, setBranch] = useState(user?.staff?.branch_id || ""),
    [department, setDepartment] = useState(user?.staff?.department_id || ""),
    [room, setRoom] = useState(user?.staff?.room_id || ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const branches = useResource<Facility[]>("/branches"),
    departments = useResource<Facility[]>("/departments"),
    rooms = useResource<Facility[]>("/rooms");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (user) {
        await put(`/admin/users/${user.id}`, {
          full_name: name,
          phone,
          ...(role ? { role_id: role } : {}),
        });
        if (role)
          await put(`/admin/users/${user.id}/assign`, {
            branch_id: branch || null,
            department_id: department || null,
            room_id: room || null,
          });
      } else
        await post("/admin/users", {
          full_name: name,
          phone,
          password,
          ...(role
            ? {
                role_id: role,
                branch_id: branch || null,
                department_id: department || null,
                room_id: room || null,
              }
            : {}),
        });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={user ? "Thông tin & phân công tài khoản" : "Tạo tài khoản"}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="modal-body">
          <Field label="Họ và tên" required>
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Số điện thoại" required>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          {!user && (
            <Field label="Mật khẩu khởi tạo" required>
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          )}
          <Field label="Vai trò">
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">Bệnh nhân</option>
              {roles
                .filter((r) => r.code !== "patient")
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
          </Field>
          {role && (
            <>
              <Field label="Chi nhánh">
                <select
                  value={branch}
                  onChange={(e) => {
                    setBranch(e.target.value);
                    setDepartment("");
                    setRoom("");
                  }}
                >
                  <option value="">Chưa phân công</option>
                  {rows(branches.data).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="form-grid">
                <Field label="Khoa / phòng ban">
                  <select
                    value={department}
                    onChange={(e) => {
                      setDepartment(e.target.value);
                      setRoom("");
                    }}
                  >
                    <option value="">Chưa phân công</option>
                    {rows(departments.data)
                      .filter((d) => d.branch_id === branch)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Phòng khám">
                  <select
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                  >
                    <option value="">Chưa phân công</option>
                    {rows(rooms.data)
                      .filter((r) => r.department_id === department)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                  </select>
                </Field>
              </div>
            </>
          )}
          <ErrorBox
            message={
              error || branches.error || departments.error || rooms.error
            }
          />
        </div>
        <div className="modal-footer">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" busy={busy}>
            Lưu tài khoản
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function NamedModal({
  type,
  entity,
  onClose,
  onSaved,
}: {
  type: "roles" | "permissions";
  entity?: Role | Permission;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(entity?.name || ""),
    [code, setCode] = useState(entity?.code || ""),
    [description, setDescription] = useState(entity?.description || ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (entity)
        await put(`/${type}/${entity.id}`, { name, code, description });
      else await post(`/${type}`, { name, code, description });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        entity
          ? "Chỉnh sửa quyền nghiệp vụ"
          : type === "roles"
            ? "Thêm vai trò"
            : "Thêm quyền nghiệp vụ"
      }
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="modal-body">
          <Field label="Tên" required>
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field
            label="Mã định danh"
            required
            hint="Chữ thường, số, dấu chấm và gạch dưới"
          >
            <input
              required
              pattern="[a-z][a-z0-9_.-]{1,99}"
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
          <ErrorBox message={error} />
        </div>
        <div className="modal-footer">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" busy={busy}>
            Lưu
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function RolePermissionsModal({
  role,
  permissions,
  onClose,
  onSaved,
}: {
  role: Role;
  permissions: Permission[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const grants = useResource<{ permission_id: string }[]>(
      `/role_permissions/${role.id}`,
    ),
    [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [name, setName] = useState(role.name),
    [description, setDescription] = useState(role.description || ""),
    [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    if (grants.data) setSelected(grants.data.map((g) => g.permission_id));
  }, [grants.data]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await put(`/roles/${role.id}`, { name, description });
      const previous = grants.data?.map((g) => g.permission_id) || [];
      const add = selected.filter((id) => !previous.includes(id));
      if (add.length)
        await post("/role_permissions", {
          role_id: role.id,
          permission_ids: add,
        });
      for (const id of previous.filter((id) => !selected.includes(id)))
        await remove(`/role_permissions/${role.id}/${id}`);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={`Phân quyền · ${role.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <Field label="Tên vai trò" required>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Mô tả">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <p className="muted">
            Chọn các quyền trực tiếp được cấp cho vai trò này.
          </p>
          {grants.loading ? (
            <Loading />
          ) : (
            permissions.map((p) => (
              <label className="permission-choice" key={p.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, p.id]
                        : selected.filter((id) => id !== p.id),
                    )
                  }
                />
                <div>
                  <strong>{p.name}</strong>
                  <small>{p.code}</small>
                </div>
              </label>
            ))
          )}
          <ErrorBox message={error || grants.error} />
          {!["admin", "doctor", "patient"].includes(role.code || "") && (
            <div className="role-delete">
              {confirmDelete ? (
                <>
                  <p>Xóa vai trò {role.name}?</p>
                  <div className="actions">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Hủy xóa
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      busy={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await remove(`/roles/${role.id}`);
                          onSaved();
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Xóa vai trò
                    </Button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  className="text-link danger-text"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={15} />
                  Xóa vai trò
                </button>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" busy={busy} disabled={grants.loading}>
            Lưu phân quyền
          </Button>
        </div>
      </form>
    </Modal>
  );
}
interface Endpoint {
  id: string;
  method: string;
  path: string;
  description?: string;
  permissions?: { permission_id: string; permission?: Permission }[];
}
function EndpointsTab({ permissions }: { permissions: Permission[] }) {
  const endpoints = useResource<Endpoint[]>("/api-endpoints"),
    [editing, setEditing] = useState<Endpoint | "new" | null>(null);
  return (
    <Card
      title="Quyền truy cập API"
      description="Gán quyền nghiệp vụ cho từng phương thức và đường dẫn API"
      action={
        <Button variant="secondary" onClick={() => setEditing("new")}>
          <Plus size={15} />
          Thêm API
        </Button>
      }
    >
      <ErrorBox message={endpoints.error} />
      {endpoints.loading ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Phương thức</th>
                <th>Đường dẫn</th>
                <th>Quyền được yêu cầu</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows(endpoints.data).map((endpoint) => (
                <tr key={endpoint.id}>
                  <td>
                    <span className="role-label">{endpoint.method}</span>
                  </td>
                  <td>
                    <code>{endpoint.path}</code>
                  </td>
                  <td>
                    {endpoint.permissions
                      ?.map((p) => p.permission?.code)
                      .filter(Boolean)
                      .join(", ") || "Chưa gán quyền"}
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label="Gán quyền API"
                      onClick={() => setEditing(endpoint)}
                    >
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <EndpointModal
          endpoint={editing === "new" ? undefined : editing}
          permissions={permissions}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            endpoints.reload();
          }}
        />
      )}
    </Card>
  );
}
function EndpointModal({
  endpoint,
  permissions,
  onClose,
  onSaved,
}: {
  endpoint?: Endpoint;
  permissions: Permission[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [method, setMethod] = useState(endpoint?.method || "GET"),
    [path, setPath] = useState(endpoint?.path || ""),
    [selected, setSelected] = useState<string[]>(
      endpoint?.permissions?.map((p) => p.permission_id) || [],
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (endpoint)
        await put(`/api-endpoints/${endpoint.id}/permissions`, {
          permission_ids: selected,
        });
      else
        await post("/api-endpoints", {
          method,
          path,
          permission_ids: selected,
        });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={endpoint ? "Gán quyền truy cập API" : "Thêm định nghĩa API"}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="modal-body">
          <div className="form-grid">
            <Field label="Phương thức">
              <select
                disabled={!!endpoint}
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                  <option value={m} key={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Đường dẫn"
              required
              hint="Không bao gồm tiền tố /api/v1"
            >
              <input
                required
                disabled={!!endpoint}
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/medical_records/:id"
              />
            </Field>
          </div>
          {permissions.map((p) => (
            <label className="permission-choice" key={p.id}>
              <input
                type="checkbox"
                checked={selected.includes(p.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, p.id]
                      : selected.filter((id) => id !== p.id),
                  )
                }
              />
              <div>
                <strong>{p.name}</strong>
                <small>{p.code}</small>
              </div>
            </label>
          ))}
          <ErrorBox message={error} />
        </div>
        <div className="modal-footer">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" busy={busy}>
            Lưu quyền truy cập
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function FacilitiesPage() {
  const branches = useResource<Facility[]>("/branches"),
    departments = useResource<Facility[]>("/departments"),
    rooms = useResource<Facility[]>("/rooms");
  const [editing, setEditing] = useState<{
      type: "branches" | "departments" | "rooms";
      facility?: Facility;
      parentId?: string;
    } | null>(null),
    [deleting, setDeleting] = useState<{
      type: string;
      facility: Facility;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const reload = () => {
    branches.reload();
    departments.reload();
    rooms.reload();
  };
  async function doDelete() {
    if (!deleting) return;
    setBusy(true);
    setError("");
    try {
      await remove(`/${deleting.type}/${deleting.facility.id}`);
      setDeleting(null);
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="HẠ TẦNG TỔ CHỨC"
        title="Cơ sở & phòng khám"
        description="Tổ chức chi nhánh, khoa và phòng khám theo mô hình phân cấp."
        action={
          <Button onClick={() => setEditing({ type: "branches" })}>
            <Plus size={18} />
            Thêm chi nhánh
          </Button>
        }
      />
      <ErrorBox
        message={error || branches.error || departments.error || rooms.error}
      />
      {branches.loading || departments.loading || rooms.loading ? (
        <Loading />
      ) : !rows(branches.data).length ? (
        <Card>
          <Empty
            title="Chưa có chi nhánh"
            text="Thêm cơ sở đầu tiên để tổ chức khoa và phòng khám."
          />
        </Card>
      ) : (
        rows(branches.data).map((branch) => (
          <Card
            key={branch.id}
            className="facility-card"
            title={branch.name}
            description={branch.address || "Chi nhánh y tế"}
            action={
              <div className="actions">
                <button
                  className="icon-button"
                  aria-label="Sửa chi nhánh"
                  onClick={() =>
                    setEditing({ type: "branches", facility: branch })
                  }
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-button danger-text"
                  aria-label="Xóa chi nhánh"
                  onClick={() =>
                    setDeleting({ type: "branches", facility: branch })
                  }
                >
                  <Trash2 size={16} />
                </button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    setEditing({ type: "departments", parentId: branch.id })
                  }
                >
                  <Plus size={15} />
                  Thêm khoa
                </Button>
              </div>
            }
          >
            <div className="facility-departments">
              {rows(departments.data)
                .filter((d) => d.branch_id === branch.id)
                .map((department) => (
                  <div className="department" key={department.id}>
                    <header>
                      <Building2 size={18} />
                      <strong>{department.name}</strong>
                      <div className="actions">
                        <button
                          className="icon-button"
                          aria-label="Sửa khoa"
                          onClick={() =>
                            setEditing({
                              type: "departments",
                              facility: department,
                            })
                          }
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="icon-button danger-text"
                          aria-label="Xóa khoa"
                          onClick={() =>
                            setDeleting({
                              type: "departments",
                              facility: department,
                            })
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                        <button
                          className="text-link"
                          onClick={() =>
                            setEditing({
                              type: "rooms",
                              parentId: department.id,
                            })
                          }
                        >
                          <Plus size={15} />
                          Phòng khám
                        </button>
                      </div>
                    </header>
                    <div className="room-grid">
                      {rows(rooms.data)
                        .filter((r) => r.department_id === department.id)
                        .map((room) => (
                          <div className="room" key={room.id}>
                            <DoorOpen size={18} />
                            <strong>{room.name}</strong>
                            <button
                              className="icon-button"
                              aria-label="Sửa phòng khám"
                              onClick={() =>
                                setEditing({ type: "rooms", facility: room })
                              }
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              className="icon-button danger-text"
                              aria-label="Xóa phòng khám"
                              onClick={() =>
                                setDeleting({ type: "rooms", facility: room })
                              }
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        ))
      )}
      {editing && (
        <FacilityModal
          {...editing}
          branches={rows(branches.data)}
          departments={rows(departments.data)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}{" "}
      {deleting && (
        <Modal title="Xóa cơ sở" onClose={() => setDeleting(null)}>
          <div className="modal-body">
            <p>
              Xóa <strong>{deleting.facility.name}</strong>? Máy chủ sẽ kiểm tra
              các đơn vị và nhân sự liên quan.
            </p>
            <ErrorBox message={error} />
          </div>
          <div className="modal-footer">
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Hủy
            </Button>
            <Button variant="danger" busy={busy} onClick={doDelete}>
              Xóa
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
function FacilityModal({
  type,
  facility,
  parentId,
  branches,
  departments,
  onClose,
  onSaved,
}: {
  type: "branches" | "departments" | "rooms";
  facility?: Facility;
  parentId?: string;
  branches: Facility[];
  departments: Facility[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(facility?.name || ""),
    [address, setAddress] = useState(facility?.address || ""),
    [parent, setParent] = useState(
      parentId || facility?.branch_id || facility?.department_id || "",
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload =
        type === "branches"
          ? { name, address }
          : type === "departments"
            ? { name, branch_id: parent }
            : { name, department_id: parent };
      if (facility) await put(`/${type}/${facility.id}`, payload);
      else await post(`/${type}`, payload);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${facility ? "Chỉnh sửa" : "Thêm"} ${type === "branches" ? "chi nhánh" : type === "departments" ? "khoa" : "phòng khám"}`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="modal-body">
          <Field label="Tên đơn vị" required>
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          {type === "branches" ? (
            <Field label="Địa chỉ">
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </Field>
          ) : (
            <Field
              label={type === "departments" ? "Chi nhánh" : "Khoa"}
              required
            >
              <select
                required
                value={parent}
                onChange={(e) => setParent(e.target.value)}
              >
                <option value="">Chọn đơn vị cha</option>
                {(type === "departments" ? branches : departments).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <ErrorBox message={error} />
        </div>
        <div className="modal-footer">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" busy={busy}>
            Lưu đơn vị
          </Button>
        </div>
      </form>
    </Modal>
  );
}
