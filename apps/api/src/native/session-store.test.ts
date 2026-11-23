import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { hashSync } from "bcryptjs";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSessionStore } from "./session-store";
import { NativeService } from "./native.service";
import type { PrismaService } from "../common/prisma.service";

const password = "FixturePassword2026!";
const encoded = hashSync(password, 4);
let account: Record<string, unknown>;
let rows: Map<string, string>;
let commands: (string | number)[][];
let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "mayday-sessions-test-"));
  account = {
    ma_tai_khoan: 1n,
    ma_nguoi: 2n,
    ma_vai_tro: 3n,
    ten_dang_nhap: "fixture",
    ho_ten: "Fixture",
    so_dien_thoai: "0999999999",
    ten_vai_tro: "benh_nhan",
    trang_thai_hoat_dong: true,
    mat_khau_ma_hoa: encoded,
  };
  rows = new Map();
  commands = [];
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("SESSION_STORE", "redis");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://sessions.example.test");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fixture-only");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, options: RequestInit) => {
      const args = JSON.parse(String(options.body)) as (string | number)[];
      commands.push(args);
      const key = String(args[1]);
      let result: unknown = null;
      if (args[0] === "SET") {
        rows.set(key, String(args[2]));
        result = "OK";
      }
      if (args[0] === "GET") result = rows.get(key) ?? null;
      if (args[0] === "DEL") result = rows.delete(key) ? 1 : 0;
      return new Response(JSON.stringify({ result }));
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  // Only remove the directory created by this test, under the OS temp directory.
  rmSync(directory, { recursive: true, force: true });
});
function service() {
  return new NativeService({
    $queryRaw: vi.fn(async () => [account]),
  } as unknown as PrismaService);
}
it("authenticates a newly issued token on another warm instance and after a cold start", async () => {
  const first = service(),
    second = service();
  const result = await first.login(
    { identifier: "fixture", password },
    "fixture",
  );
  const expected = { accountId: "1", personId: "2", role: "benh_nhan" };
  expect(await second.authenticate(`Bearer ${result.token}`)).toEqual(expected);
  expect(await service().authenticate(`Bearer ${result.token}`)).toEqual(
    expected,
  );
  expect(second.schema(expected).length).toBeGreaterThan(0);
  const write = commands.find((args) => args[0] === "SET")!;
  expect(write[1]).toBe(
    `mayday:session:v1:${createHash("sha256").update(result.token).digest("hex")}`,
  );
  expect(JSON.stringify([...rows])).not.toContain(result.token);
  expect(write[3]).toBe("PX");
  expect(Number(write[4])).toBeGreaterThan(7_190_000);
  expect(Number(write[4])).toBeLessThanOrEqual(7_200_000);
});
it("revokes logout across every instance without a per-instance cached copy", async () => {
  const first = service(),
    second = service();
  const { token } = await first.login(
    { identifier: "fixture", password },
    "fixture",
  );
  await second.authenticate(`Bearer ${token}`);
  await service().logout(`Bearer ${token}`);
  await expect(first.authenticate(`Bearer ${token}`)).rejects.toMatchObject({
    code: 3003,
  });
  await expect(second.authenticate(`Bearer ${token}`)).rejects.toMatchObject({
    code: 3003,
  });
});
it("still rejects expired sessions and account changes", async () => {
  const { token } = await service().login(
    { identifier: "fixture", password },
    "fixture",
  );
  account.ma_vai_tro = 4n;
  await expect(service().authenticate(`Bearer ${token}`)).rejects.toMatchObject(
    { code: 3001 },
  );
  account.ma_vai_tro = 3n;
  account.trang_thai_hoat_dong = false;
  await expect(service().authenticate(`Bearer ${token}`)).rejects.toMatchObject(
    { code: 3001 },
  );
  account.trang_thai_hoat_dong = true;
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 7_200_001);
  await expect(service().authenticate(`Bearer ${token}`)).rejects.toMatchObject(
    { code: 3003 },
  );
  vi.restoreAllMocks();
});
it("does not return a login token when shared persistence fails or is not configured", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "fixture unavailable" }), {
          status: 503,
        }),
    ),
  );
  await expect(
    service().login({ identifier: "fixture", password }, "fixture"),
  ).rejects.toMatchObject({ code: 9001 });
  const store = createSessionStore({
    VERCEL: "1",
    SESSION_FILE: join(directory, "unsafe.json"),
  });
  await expect(
    store.set("hash", {
      accountId: "1",
      fingerprint: "a".repeat(64),
      expires: Date.now() + 10000,
    }),
  ).rejects.toMatchObject({ code: 9001 });
  const badMode = createSessionStore({
    VERCEL: "1",
    SESSION_STORE: "file",
    SESSION_FILE: join(directory, "unsafe.json"),
  });
  await expect(badMode.get("hash")).rejects.toMatchObject({ code: 9001 });
});
it("preserves local file sessions across restarts and deletes only the selected session", async () => {
  const path = join(directory, "sessions.json");
  const env = { SESSION_STORE: "file", SESSION_FILE: path };
  const value = {
    accountId: "1",
    fingerprint: "a".repeat(64),
    expires: Date.now() + 10000,
  };
  await createSessionStore(env).set("first", value);
  await createSessionStore(env).set("second", value);
  expect(await createSessionStore(env).get("first")).toEqual(value);
  await createSessionStore(env).delete("first");
  expect(await createSessionStore(env).get("first")).toBeUndefined();
  expect(await createSessionStore(env).get("second")).toEqual(value);
  expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ second: value });
});
