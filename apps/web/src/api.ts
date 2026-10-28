import type { User } from "./types";

export interface Session {
  token: string;
  user: User;
}
const SESSION_KEY = "mayday.session";
let session: Session | null = null;
export function restoreSession(): Session | null {
  try {
    const parsed = JSON.parse(
      sessionStorage.getItem(SESSION_KEY) || "null",
    ) as Session | null;
    session =
      typeof parsed?.token === "string" &&
      parsed.token.length > 0 &&
      typeof parsed.user?.id === "string" &&
      typeof parsed.user?.full_name === "string" &&
      parsed.user?.role
        ? parsed
        : null;
  } catch {
    session = null;
  }
  return session;
}
export function storeSession(value: Session | null) {
  session = value;
  if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
  else sessionStorage.removeItem(SESSION_KEY);
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: number,
  ) {
    super(message);
  }
}
async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T; meta?: PageMeta }> {
  const headers = new Headers(options.headers);
  if (session?.token) headers.set("Authorization", `Bearer ${session.token}`);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(
      `${import.meta.env.VITE_API_URL || "/api/v1"}${path}`,
      { ...options, headers },
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(
      "Không kết nối được máy chủ. Vui lòng kiểm tra kết nối và thử lại.",
      0,
    );
  }
  const envelope = (await response.json().catch(() => null)) as {
    code?: number;
    message?: string | string[];
    data?: T;
    meta?: PageMeta;
  } | null;
  if (
    !response.ok ||
    (envelope?.code && envelope.code !== 1000 && envelope.code !== 1001)
  ) {
    if (response.status === 401) {
      storeSession(null);
      window.dispatchEvent(new Event("mayday:unauthorized"));
    }
    const message = Array.isArray(envelope?.message)
      ? envelope.message.join("; ")
      : envelope?.message;
    throw new ApiError(
      message || `Yêu cầu thất bại (${response.status}).`,
      response.status,
      envelope?.code,
    );
  }
  return { data: envelope?.data as T, meta: envelope?.meta };
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return (await request<T>(path, options)).data;
}
export const post = <T>(path: string, data: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(data) });
export const put = <T>(path: string, data: unknown) =>
  api<T>(path, { method: "PUT", body: JSON.stringify(data) });
export const patch = <T>(path: string, data: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(data) });
export const remove = (path: string) => api(path, { method: "DELETE" });
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  total_pages?: number;
  pages?: number;
}
export async function apiPage<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ items: T[]; meta?: PageMeta }> {
  const envelope = await request<T[]>(path, options);
  return { items: envelope.data, meta: envelope.meta };
}
