import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronLeft,
  LoaderCircle,
  Search,
  X,
} from "lucide-react";
import { api, apiPage, type PageMeta } from "./api";

export const date = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(value))
    : "—";
export function useResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    const abort = new AbortController();
    if (!path) {
      setLoading(false);
      setData(null);
      return;
    }
    setLoading(true);
    setError("");
    api<T>(path, { signal: abort.signal })
      .then(setData)
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [path, version]);
  return { data, loading, error, reload, setData };
}
export function usePagedResource<T>(path: string | null) {
  const [data, setData] = useState<T[] | null>(null),
    [meta, setMeta] = useState<PageMeta | undefined>(),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    const abort = new AbortController();
    if (!path) {
      setLoading(false);
      setData(null);
      setMeta(undefined);
      return;
    }
    setLoading(true);
    setError("");
    apiPage<T>(path, { signal: abort.signal })
      .then((page) => {
        setData(page.items);
        setMeta(page.meta);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [path, version]);
  return { data, meta, loading, error, reload };
}
export function Pagination({
  meta,
  page,
  onChange,
}: {
  meta?: PageMeta;
  page: number;
  onChange: (page: number) => void;
}) {
  if (
    !meta ||
    (meta.total_pages ?? meta.pages ?? Math.ceil(meta.total / meta.limit)) < 2
  )
    return null;
  const totalPages =
    meta.total_pages ?? meta.pages ?? Math.ceil(meta.total / meta.limit);
  return (
    <div className="pagination">
      <span>
        Trang {page} / {totalPages} · {meta.total} bản ghi
      </span>
      <div className="actions">
        <Button
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Trang trước
        </Button>
        <Button
          variant="secondary"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Trang sau
        </Button>
      </div>
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Button({
  children,
  variant = "primary",
  busy,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      className={`button ${variant} ${props.className || ""}`}
      disabled={props.disabled || busy}
    >
      {busy ? <LoaderCircle size={16} className="spin" /> : null}
      {children}
    </button>
  );
}
export function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <em> *</em>}
      </span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function ErrorBox({ message }: { message?: string }) {
  return message ? (
    <div className="error-box" role="alert">
      <AlertCircle size={17} />
      {message}
    </div>
  ) : null;
}
export function Success({ message }: { message?: string }) {
  return message ? (
    <div className="success-box" role="status">
      <Check size={17} />
      {message}
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="loading">
      <LoaderCircle size={24} className="spin" />
      <span>Đang tải dữ liệu…</span>
    </div>
  );
}
export function Empty({
  title = "Chưa có dữ liệu",
  text,
  action,
}: {
  title?: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Search size={27} />
      </div>
      <h3>{title}</h3>
      <p>{text || "Dữ liệu sẽ xuất hiện tại đây khi được ghi nhận."}</p>
      {action}
    </div>
  );
}
const modalStack: HTMLElement[] = [];
let pageOverflow = "";
export function Modal({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const element = useRef<HTMLElement>(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const current = element.current!;
    const previous = document.activeElement as HTMLElement | null;
    if (!modalStack.length) {
      pageOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    modalStack.forEach((m) => {
      m.inert = true;
    });
    modalStack.push(current);
    current.querySelector<HTMLElement>("button,input,select,textarea")?.focus();
    const key = (e: KeyboardEvent) => {
      if (modalStack.at(-1) !== current) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const controls = Array.from(
          current.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
          ),
        ).filter((el) => el.getClientRects().length > 0);
        const first = controls[0],
          last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      const i = modalStack.indexOf(current);
      if (i >= 0) modalStack.splice(i, 1);
      if (modalStack.at(-1)) modalStack.at(-1)!.inert = false;
      else document.body.style.overflow = pageOverflow;
      if (previous?.isConnected && !previous.closest("[inert]"))
        previous.focus();
    };
  }, []);
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={element}
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Đóng" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}
export function Badge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    pending: "Chờ tiếp nhận",
    in_progress: "Đang khám",
    completed: "Hoàn thành",
    active: "Đang hoạt động",
    inactive: "Ngừng hoạt động",
  };
  return <span className={`badge ${status}`}>{labels[status] || status}</span>;
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Tìm theo tên hoặc số điện thoại…",
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-box">
      <Search size={18} />
      <input
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
export function Back({ onClick }: { onClick: () => void }) {
  return (
    <button className="back" onClick={onClick}>
      <ChevronLeft size={17} />
      Quay lại danh sách
    </button>
  );
}
export function Card({
  title,
  description,
  children,
  action,
  className = "",
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <header className="card-heading">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
export function RowArrow() {
  return <ArrowRight size={17} className="muted" />;
}
