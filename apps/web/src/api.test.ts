import { afterEach, expect, test, vi } from "vitest";
import { apiPage, restoreSession, storeSession, apiBlob } from "./api";

afterEach(() => vi.unstubAllGlobals());
test("rejects corrupted saved sessions instead of treating them as authenticated", () => {
  vi.stubGlobal("sessionStorage", {
    getItem: () => JSON.stringify({ token: 123, user: { id: "user-id" } }),
  });
  expect(restoreSession()).toBeNull();
});

test("downloads private images with the session token rather than exposing an unauthenticated URL", async () => {
  vi.stubGlobal("sessionStorage", { setItem: vi.fn(), removeItem: vi.fn() });
  storeSession({
    token: "private-session",
    user: {
      id: "1",
      full_name: "Test",
      phone: "0999999999",
      role: "benh_nhan",
    },
  });
  const fetcher = vi.fn(
    async (_url: string | URL | Request, _options?: RequestInit) =>
      new Response(new Blob(["image"], { type: "image/png" }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetcher);
  const blob = await apiBlob("/image-attachments/1/content");
  expect(await blob.text()).toBe("image");
  expect(
    new Headers(fetcher.mock.calls[0][1]?.headers).get("Authorization"),
  ).toBe("Bearer private-session");
  storeSession(null);
});

test("preserves server pagination totals alongside decoded record rows", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            code: 1000,
            data: [{ id: "record" }],
            meta: { page: 1, limit: 25, total: 120, total_pages: 5 },
          }),
          { status: 200 },
        ),
    ),
  );
  const page = await apiPage<{ id: string }>("/data/hosobenhan");
  expect(page).toEqual({
    items: [{ id: "record" }],
    meta: { page: 1, limit: 25, total: 120, total_pages: 5 },
  });
});
