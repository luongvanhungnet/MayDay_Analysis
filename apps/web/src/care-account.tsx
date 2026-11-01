import { confirmAction } from "./confirmation";
import { useEffect, useState, type FormEvent } from "react";
import { api, post, put, remove, storeSession, type Session } from "./api";
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
import {
  ActionForm,
  Details,
  ReferenceSelect,
  Rows,
  useSearch,
} from "./care-ui";
const { f } = fields;
export function Signup({
  close,
  saved,
}: {
  close: () => void;
  saved: () => void;
}) {
  return (
    <ActionForm
      title="Đăng ký tài khoản bệnh nhân"
      fields={[
        f("full_name", "Họ và tên", { required: true }),
        f("phone", "Số điện thoại (10 chữ số)", { required: true }),
        f("password", "Mật khẩu (ít nhất 10 ký tự)", {
          type: "password",
          required: true,
        }),
        f("gender", "Giới tính", { type: "select", options: ["Nam", "Nu"] }),
      ]}
      close={close}
      saved={saved}
      onSubmit={(d) => post("/auth/signup", d)}
      submitText="Tạo tài khoản"
      note="Tài khoản được tạo dành cho bệnh nhân. Sau khi đăng ký, bạn có thể đăng nhập bằng số điện thoại và mật khẩu vừa chọn."
    />
  );
}
export function ProfilePage({ session }: { session: Session }) {
  const profile = useResource<Row>("/profile"),
    [editing, setEditing] = useState(false),
    [success, setSuccess] = useState("");
  const patient = (profile.data?.patient ?? {}) as Row;
  const inputs = [
    f("full_name", "Họ và tên", { required: true }),
    f("phone", "Số điện thoại (10 chữ số)", { required: true }),
    f("date_of_birth", "Ngày sinh", { type: "date" }),
    f("gender", "Giới tính", { type: "select", options: ["Nam", "Nu"] }),
    f("province", "Tỉnh / thành phố"),
    f("ward", "Xã / phường"),
    f("address", "Địa chỉ"),
    ...(session.user.role === "benh_nhan"
      ? [
          f("occupation", "Nghề nghiệp", {
            type: "select",
            options: [
              "Cong nhan",
              "Nong dan",
              "Hoc sinh - Sinh vien",
              "Can bo cong chuc",
              "Khac",
            ],
          }),
          f("ethnicity", "Dân tộc"),
          f("insurance_number", "Số thẻ BHYT"),
          f("insurance_expiry", "BHYT có giá trị đến", { type: "date" }),
          f("relative_name_address", "Họ tên / địa chỉ người nhà"),
          f("relative_phone", "Số điện thoại người nhà"),
        ]
      : []),
  ];
  return (
    <section className="native-content">
      <div className="page-title">
        <div>
          <span className="eyebrow">TÀI KHOẢN CỦA BẠN</span>
          <h1>Hồ sơ cá nhân</h1>
          <p className="muted">Thông tin liên hệ và hồ sơ cá nhân.</p>
        </div>
        <Button
          disabled={profile.loading || !profile.data}
          onClick={() => setEditing(true)}
        >
          Cập nhật thông tin
        </Button>
      </div>
      <Success message={success} />
      <ErrorBox message={profile.error} />
      <div className="card care-panel">
        {profile.loading ? (
          <Loading />
        ) : (
          profile.data && (
            <>
              <Details
                data={Object.fromEntries(
                  Object.entries(profile.data).filter(([k]) => k !== "patient"),
                )}
              />
              {Object.keys(patient).length > 0 && (
                <>
                  <h3>Thông tin bệnh nhân</h3>
                  <Details data={patient} />
                </>
              )}
            </>
          )
        )}
      </div>
      {editing && (
        <ActionForm
          title="Cập nhật hồ sơ cá nhân"
          fields={inputs}
          original={{ ...profile.data, ...patient }}
          close={() => setEditing(false)}
          onSubmit={(d) =>
            put<Row>("/profile", d).then((p) => {
              storeSession({
                ...session,
                user: {
                  ...session.user,
                  full_name: String(p.full_name),
                  phone: String(p.phone),
                },
              });
              window.dispatchEvent(new Event("mayday:profile"));
              return p;
            })
          }
          saved={() => {
            setEditing(false);
            setSuccess("Đã cập nhật hồ sơ.");
            profile.reload();
          }}
        />
      )}
    </section>
  );
}
export function UsersPage({ session }: { session: Session }) {
  const [page, setPage] = useState(1),
    [edit, setEdit] = useState<Row | null>(null),
    [detail, setDetail] = useState<Row | null>(null),
    [create, setCreate] = useState(""),
    [assign, setAssign] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const { search, setSearch, query } = useSearch();
  useEffect(() => setPage(1), [query]);
  const list = usePagedResource<Row>(
    `/admin/users?page=${page}&search=${encodeURIComponent(query)}`,
  );
  const roles = useResource<Row[]>("/roles");
  const patientRole = roles.data?.find((r) => r.name === "benh_nhan");
  const refresh = () => {
    setEdit(null);
    setCreate("");
    setAssign(null);
    setSuccess("Đã lưu thay đổi.");
    list.reload();
  };
  async function view(row: Row) {
    setError("");
    try {
      setDetail(await api<Row>(`/admin/users/${row.id}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function disable(row: Row) {
    if (
      !(await confirmAction(
        "Khóa tài khoản này? Người dùng sẽ phải liên hệ quản trị viên để được mở lại.",
      ))
    )
      return;
    setError("");
    try {
      await remove(`/admin/users/${row.id}`);
      setSuccess("Đã khóa tài khoản. Hồ sơ khám vẫn được giữ lại.");
      list.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const createFields = [
    f("full_name", "Họ và tên", { required: true }),
    f("phone", "Số điện thoại (10 chữ số)", { required: true }),
    f("password", "Mật khẩu (ít nhất 10 ký tự)", {
      type: "password",
      required: true,
    }),
    f("gender", "Giới tính", { type: "select", options: ["Nam", "Nu"] }),
    f("role_id", "Vai trò", {
      reference: "roles",
      required: create === "staff",
    }),
    f("branch_id", "Chi nhánh (bắt buộc với nhân viên)", {
      reference: "branches",
      required: create === "staff",
    }),
    f("is_active", "Đang hoạt động", { type: "boolean" }),
  ];
  const roleLabels = Object.fromEntries(
    (roles.data ?? []).map((r) => [String(r.id), r.display_name ?? r.name]),
  );
  return (
    <section className="native-content">
      <div className="page-title">
        <div>
          <span className="eyebrow">QUẢN TRỊ</span>
          <h1>Tài khoản & nhân viên</h1>
          <p className="muted">
            Cấp tài khoản, phân công chi nhánh và quản lý truy cập.
          </p>
        </div>
        <div className="native-actions">
          <Button
            variant="secondary"
            disabled={!patientRole}
            onClick={() => setCreate("existing")}
          >
            Cấp cho bệnh nhân đã có hồ sơ
          </Button>
          <Button variant="secondary" onClick={() => setCreate("user")}>
            Cấp tài khoản
          </Button>
          <Button onClick={() => setCreate("staff")}>Thêm nhân viên</Button>
        </div>
      </div>
      <Success message={success} />
      <ErrorBox message={error || list.error} />
      <div className="card">
        <div className="native-toolbar">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tên đăng nhập…"
            aria-label="Tìm tài khoản"
          />
        </div>
        {list.loading ? (
          <Loading />
        ) : list.data?.length ? (
          <Rows
            rows={list.data.map((r) => ({
              ...r,
              role_label: roleLabels[String(r.role_id)] ?? r.role_id,
            }))}
            columns={["id", "username", "person_id", "role_label", "is_active"]}
            actions={(r) => (
              <>
                <button className="text-link" onClick={() => void view(r)}>
                  Chi tiết
                </button>
                <button className="text-link" onClick={() => setEdit(r)}>
                  Sửa
                </button>
                <button className="text-link" onClick={() => setAssign(r)}>
                  Phân công
                </button>
                {r.id !== session.user.id && r.is_active !== false && (
                  <button
                    className="text-link danger-text"
                    onClick={() => void disable(r)}
                  >
                    Khóa
                  </button>
                )}
              </>
            )}
          />
        ) : (
          <Empty />
        )}
        <Pagination meta={list.meta} page={page} onChange={setPage} />
      </div>
      {create === "existing" && patientRole && (
        <ActionForm
          title="Cấp tài khoản cho bệnh nhân đã tiếp nhận"
          fields={[
            f("person_id", "Bệnh nhân đã tiếp nhận", {
              reference: "patients",
              required: true,
            }),
            f("username", "Tên đăng nhập", { required: true }),
            f("password", "Mật khẩu (ít nhất 10 ký tự)", {
              type: "password",
              required: true,
            }),
          ]}
          close={() => setCreate("")}
          onSubmit={(d) =>
            post("/data/taikhoan", {
              ma_nguoi: d.person_id,
              ma_vai_tro: String(patientRole.id),
              ten_dang_nhap: d.username,
              password: d.password,
            })
          }
          saved={refresh}
          note="Liên kết tài khoản với hồ sơ bệnh nhân hiện có. Thông tin người và lịch sử khám được giữ nguyên."
        />
      )}
      {create && create !== "existing" && (
        <ActionForm
          title={create === "staff" ? "Thêm nhân viên" : "Cấp tài khoản"}
          fields={createFields}
          close={() => setCreate("")}
          onSubmit={(d) =>
            post(
              create === "staff" ? "/auth/admin/create-staff" : "/admin/users",
              d,
            )
          }
          saved={refresh}
          note="Chọn chi nhánh nếu cấp tài khoản nhân viên. Tài khoản bệnh nhân không cần chi nhánh."
        />
      )}
      {edit && (
        <ActionForm
          title={`Cập nhật tài khoản ${edit.username}`}
          fields={[
            f("username", "Tên đăng nhập", { required: true }),
            f("password", "Mật khẩu mới (để trống để giữ nguyên)", {
              type: "password",
            }),
            ...(edit.id === session.user.id
              ? []
              : [
                  f("role_id", "Vai trò", { reference: "roles" }),
                  f("is_active", "Đang hoạt động", { type: "boolean" }),
                ]),
          ]}
          original={edit}
          close={() => setEdit(null)}
          onSubmit={(d) => {
            if (d.password === null) delete d.password;
            return put(`/admin/users/${edit.id}`, d);
          }}
          saved={refresh}
        />
      )}
      {assign && (
        <ActionForm
          title={`Phân công · ${assign.username}`}
          fields={[
            f("branch_id", "Chi nhánh", {
              reference: "branches",
              required: true,
            }),
          ]}
          close={() => setAssign(null)}
          saved={refresh}
          onSubmit={(d) => put(`/admin/users/${assign.id}/assign`, d)}
          note="Chỉ phân công được tài khoản đã có hồ sơ nhân viên."
        />
      )}
      {detail && (
        <Modal title="Chi tiết tài khoản" onClose={() => setDetail(null)}>
          <div className="modal-body">
            <Details data={detail} />
          </div>
        </Modal>
      )}
    </section>
  );
}
export function GrantsPage() {
  const [roleId, setRoleId] = useState(""),
    [page, setPage] = useState(1),
    [chosen, setChosen] = useState<Set<string>>(new Set()),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false);
  const grants = useResource<{ role_id: string; permissions: Row[] }>(
      roleId ? `/role_permissions/${roleId}` : null,
    ),
    permissions = usePagedResource<Row>(`/permissions?limit=25&page=${page}`);
  const ready =
    !!roleId &&
    grants.data?.role_id === roleId &&
    !grants.loading &&
    !grants.error;
  useEffect(() => {
    if (grants.data?.role_id === roleId)
      setChosen(new Set(grants.data.permissions.map((p) => String(p.id))));
  }, [grants.data, roleId]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError("");
    setSuccess("");
    const active = new Set(grants.data!.permissions.map((p) => String(p.id)));
    try {
      const added = [...chosen].filter((id) => !active.has(id));
      if (added.length)
        await post("/role_permissions", {
          role_id: roleId,
          permission_ids: added,
        });
      for (const id of active)
        if (!chosen.has(id)) await remove(`/role_permissions/${roleId}/${id}`);
      setSuccess("Đã cập nhật các quyền cho vai trò.");
    } catch (e) {
      setError(
        `${(e as Error).message} Danh sách sẽ được tải lại để phản ánh các thay đổi đã lưu.`,
      );
    } finally {
      setBusy(false);
      grants.reload();
    }
  }
  return (
    <section className="native-content">
      <div className="page-title">
        <div>
          <span className="eyebrow">QUẢN TRỊ TRUY CẬP</span>
          <h1>Gán quyền cho vai trò</h1>
          <p className="muted">
            Xem, cấp và thu hồi các quyền đã được định nghĩa.
          </p>
        </div>
      </div>
      <div className="card care-panel">
        <Field label="Vai trò">
          <ReferenceSelect
            reference="roles"
            value={roleId}
            onChange={(v) => {
              setRoleId(v);
              setChosen(new Set());
              setError("");
              setSuccess("");
            }}
            labelText="vai trò"
          />
        </Field>
        <p className="care-note">
          Danh sách quyền được lưu theo vai trò. Quyền thao tác khám bệnh vẫn
          tuân theo chính sách của hệ thống.
        </p>
        <Success message={success} />
        <ErrorBox message={error || grants.error || permissions.error} />
        {!roleId ? (
          <Empty title="Chọn vai trò để quản lý quyền" />
        ) : !ready || permissions.loading ? (
          <Loading />
        ) : (
          <form onSubmit={submit}>
            <div className="care-permissions">
              {permissions.data?.length ? (
                permissions.data.map((p) => (
                  <label key={String(p.id)}>
                    <input
                      type="checkbox"
                      checked={chosen.has(String(p.id))}
                      disabled={busy}
                      onChange={(e) =>
                        setChosen((old) => {
                          const next = new Set(old);
                          if (e.target.checked) next.add(String(p.id));
                          else next.delete(String(p.id));
                          return next;
                        })
                      }
                    />
                    <span>
                      <strong>{String(p.name)}</strong>
                      <small>{String(p.description ?? "")}</small>
                    </span>
                  </label>
                ))
              ) : (
                <Empty title="Chưa có quyền nào" />
              )}
            </div>
            <Pagination
              meta={permissions.meta}
              page={page}
              onChange={setPage}
            />
            <Button type="submit" busy={busy}>
              Lưu quyền đã chọn
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
