import type { Session } from "./api";
import {
  Activity,
  ArrowRight,
  Camera,
  ClipboardList,
  HeartPulse,
  Hospital,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Row } from "./care-model";
import { careLink, follow } from "./navigation";
import { Badge, ErrorBox, Loading, usePagedResource, useResource } from "./ui";

const homeIcons = {
  uas: Activity,
  lesions: Camera,
  records: ClipboardList,
  users: Users,
  roles: ShieldCheck,
  branches: Hospital,
};

export default function CareHome({ session }: { session: Session }) {
  const patient = session.user.role === "benh_nhan";
  const records = usePagedResource<Row>(
    patient ? "/medical_records/all?limit=5" : null,
  );
  const eligibility = useResource<{ eligible: boolean }>(
    patient ? "/uas7-scores/eligibility" : null,
  );
  const links: [keyof typeof homeIcons, string, string][] = patient
    ? [
        [
          "uas",
          "Ghi UAS hôm nay",
          "Ghi điểm sẩn phù và ngứa, xem lại nhật ký.",
        ],
        [
          "lesions",
          "Thêm ảnh tổn thương",
          "Theo dõi theo đợt, vị trí và mốc tiến triển.",
        ],
        ["records", "Hồ sơ của tôi", "Xem phiên khám, kết quả và dặn dò."],
      ]
    : [
        [
          "users",
          "Tài khoản & nhân viên",
          "Tạo tài khoản, phân công chi nhánh và khóa tài khoản.",
        ],
        [
          "roles",
          "Vai trò & quyền",
          "Quản lý vai trò, quyền hạn và gán quyền.",
        ],
        [
          "branches",
          "Cơ sở khám",
          "Quản lý chi nhánh, khoa phòng và phòng khám.",
        ],
        ["records", "Nghiệp vụ khám bệnh", "Tiếp nhận và theo dõi hồ sơ khám."],
      ];
  return (
    <section className="native-content">
      <div className="page-title home-heading">
        <div>
          <h1>{patient ? "Hôm nay" : "Tổng quan quản trị"}</h1>
          <p className="muted">Xin chào, {session.user.full_name}.</p>
        </div>
        <HeartPulse className="home-heading-icon" size={124} aria-hidden="true" />
      </div>
      <div className="journey-grid">
        {links.map(([view, title, description]) => {
          const Icon = homeIcons[view];
          return (
            <a
              className="card home-action"
              href={careLink(view)}
              onClick={follow}
              key={view}
            >
              <span className="home-action-icon">
                <Icon size={21} aria-hidden="true" />
              </span>
              <h2>{title}</h2>
              <p>{description}</p>
              <ArrowRight className="home-action-arrow" size={18} aria-hidden="true" />
            </a>
          );
        })}
      </div>
      {patient && (
        <>
          <ErrorBox message={records.error || eligibility.error} />
          {eligibility.data && !eligibility.data.eligible && (
            <p className="care-note">
              Bạn chưa có hồ sơ mạn phù hợp để ghi UAS. Mở Hồ sơ của tôi hoặc
              liên hệ cơ sở khám.
            </p>
          )}
          <h2>Hồ sơ gần đây</h2>
          {records.loading ? (
            <Loading />
          ) : records.data?.length ? (
            records.data.map((r) => (
              <a
                className="card care-panel journey-record"
                key={String(r.id)}
                href={careLink("records", { record: String(r.id) })}
                onClick={follow}
              >
                Hồ sơ #{String(r.id)} ·{" "}
                {r.record_type === "MAN" ? "Mề đay mạn" : "Mề đay cấp"}{" "}
                <Badge status={String(r.status)} />
              </a>
            ))
          ) : (
            <p>
              Chưa có hồ sơ khám.{" "}
              <a href={careLink("records")} onClick={follow}>
                Mở hồ sơ của tôi
              </a>
            </p>
          )}
        </>
      )}
    </section>
  );
}
