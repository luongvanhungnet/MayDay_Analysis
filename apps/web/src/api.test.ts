import { afterEach, expect, test, vi } from "vitest";
import { apiPage, restoreSession } from "./api";

afterEach(() => vi.unstubAllGlobals());
test("rejects corrupted saved sessions instead of treating them as authenticated", () => {
  vi.stubGlobal("sessionStorage", {
    getItem: () => JSON.stringify({ token: 123, user: { id: "user-id" } }),
  });
  expect(restoreSession()).toBeNull();
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
