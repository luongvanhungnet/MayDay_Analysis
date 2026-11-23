import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";
import { confirmAction } from "./confirmation";

const unsaved = new Set<symbol>();
export async function canLeave() {
  return (
    !unsaved.size ||
    (await confirmAction(
      "Bạn có thay đổi chưa lưu. Rời trang và bỏ các thay đổi này?",
    ))
  );
}
export function useUnsavedChanges(dirty: boolean) {
  const key = useRef(Symbol());
  useEffect(() => {
    if (dirty) unsaved.add(key.current);
    else unsaved.delete(key.current);
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (unsaved.size) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      unsaved.delete(key.current);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [dirty]);
  return {
    markSaved: () => unsaved.delete(key.current),
    allowLeave: async () =>
      !dirty ||
      (await confirmAction(
        "Bạn có thay đổi chưa lưu. Rời biểu mẫu và bỏ các thay đổi này?",
      )),
  };
}

const event = "mayday:navigate";
let installed = false;
let currentIndex = 0;
let restoring: (() => void) | undefined;
let approvedTraversal = false;
function restoreScroll() {
  if (typeof document.documentElement.scrollTo === "function")
    requestAnimationFrame(() =>
      window.scrollTo(0, history.state?.maydayScroll ?? 0),
    );
}
function initializeHistory() {
  if (!Number.isInteger(history.state?.maydayIndex))
    history.replaceState({ ...history.state, maydayIndex: 0 }, "");
  currentIndex = history.state.maydayIndex;
  if (installed) return;
  installed = true;
  window.addEventListener("popstate", () => {
    if (restoring) {
      const done = restoring;
      restoring = undefined;
      done();
      return;
    }
    const nextIndex = history.state?.maydayIndex;
    const delta = Number.isInteger(nextIndex) ? nextIndex - currentIndex : 0;
    if (unsaved.size && delta && !approvedTraversal) {
      restoring = () => {
        void confirmAction(
          "Bạn có thay đổi chưa lưu. Rời trang và bỏ các thay đổi này?",
        ).then((ok) => {
          if (ok) {
            approvedTraversal = true;
            history.go(delta);
          }
        });
      };
      history.go(-delta);
      return;
    }
    approvedTraversal = false;
    if (Number.isInteger(nextIndex)) currentIndex = nextIndex;
    window.dispatchEvent(new Event(event));
    restoreScroll();
  });
}
function subscribe(update: () => void) {
  initializeHistory();
  window.addEventListener(event, update);
  return () => {
    window.removeEventListener(event, update);
  };
}
export function useLocationSearch() {
  return useSyncExternalStore(subscribe, () => window.location.search);
}
export async function go(search: string, replace = false) {
  if (search === window.location.search) return;
  if (!replace && !(await canLeave())) return;
  initializeHistory();
  const index = currentIndex + (replace ? 0 : 1);
  if (!replace)
    history.replaceState(
      { ...history.state, maydayScroll: window.scrollY },
      "",
    );
  history[replace ? "replaceState" : "pushState"](
    {
      ...history.state,
      maydayIndex: index,
      maydayScroll: replace ? window.scrollY : 0,
    },
    "",
    search || window.location.pathname,
  );
  currentIndex = index;
  window.dispatchEvent(new Event(event));
  if (!replace) restoreScroll();
}
export function careLink(
  view: string,
  context: Record<string, string | undefined> = {},
) {
  const params = new URLSearchParams({ view });
  Object.entries(context).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return `?${params}`;
}
export function clinicalLink(
  table: string,
  filter: Record<string, string>,
  recordId: string,
) {
  return `?${new URLSearchParams({ table, filter: JSON.stringify(filter), return_record: recordId })}`;
}
export function useUrlState(
  key: string,
  fallback: number,
): [number, Dispatch<SetStateAction<number>>];
export function useUrlState(
  key: string,
  fallback: string,
): [string, Dispatch<SetStateAction<string>>];
export function useUrlState<T extends string | number>(
  key: string,
  fallback: T,
): [T, Dispatch<SetStateAction<T>>] {
  const search = useLocationSearch();
  const raw = new URLSearchParams(search).get(key);
  const value = (
    typeof fallback === "number"
      ? raw && /^\d+$/.test(raw) && Number(raw) > 0
        ? Number(raw)
        : fallback
      : (raw ?? fallback)
  ) as T;
  return [
    value,
    (next) => {
      const params = new URLSearchParams(window.location.search);
      const resolved = typeof next === "function" ? next(value) : next;
      if (resolved === fallback || resolved === "") params.delete(key);
      else params.set(key, String(resolved));
      go(`?${params}`, true);
    },
  ];
}

export function JourneyLinks({
  patientId,
  recordId,
}: {
  patientId?: string;
  recordId?: string;
}) {
  const context = patientId ? { patient: patientId } : {};
  return (
    <nav className="journey-links" aria-label="Hành trình chăm sóc">
      <a href={careLink("records", context)} onClick={follow}>
        Hồ sơ khám
      </a>
      <a href={careLink("uas", context)} onClick={follow}>
        Nhật ký UAS
      </a>
      <a
        href={careLink("lesions", {
          ...context,
          ...(recordId ? { medical_record: recordId } : {}),
        })}
        onClick={follow}
      >
        Tổn thương & ảnh
      </a>
    </nav>
  );
}
export function follow(e: React.MouseEvent<HTMLAnchorElement>) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
    return;
  e.preventDefault();
  go(e.currentTarget.search);
}
