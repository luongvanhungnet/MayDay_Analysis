import type { Session } from "./api";
import { availableMenus, resources } from "./care-model";
import { ResourcePage } from "./care-ui";
import { RecordsPage, PatientsPage, UasPage } from "./care-clinical";
import { GrantsPage, ProfilePage, UsersPage } from "./care-account";
import { LesionsPage, MediaPage } from "./care-media";
import { Empty } from "./ui";
export default function CarePage({
  page,
  session,
}: {
  page: string;
  session: Session;
}) {
  if (!availableMenus(session.user.role).some((m) => m.id === page))
    return <Empty title="Bạn không có quyền truy cập chức năng này" />;
  if (page === "records") return <RecordsPage session={session} />;
  if (page === "patients") return <PatientsPage />;
  if (page === "uas") return <UasPage session={session} />;
  if (page === "lesions") return <LesionsPage session={session} />;
  if (page === "media") return <MediaPage session={session} />;
  if (page === "profile") return <ProfilePage session={session} />;
  if (page === "users") return <UsersPage session={session} />;
  if (page === "grants") return <GrantsPage />;
  if (resources[page])
    return (
      <ResourcePage config={resources[page]} userRole={session.user.role} />
    );
  return <Empty />;
}
