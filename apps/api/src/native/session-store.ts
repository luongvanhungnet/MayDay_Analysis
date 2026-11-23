import Redis from "ioredis";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { DomainException } from "../common/domain.exception";

export type StoredSession = {
  accountId: string;
  fingerprint: string;
  expires: number;
};
export interface SessionStore {
  get(hash: string): Promise<StoredSession | undefined>;
  set(hash: string, session: StoredSession): Promise<void>;
  delete(hash: string): Promise<void>;
  close?(): void;
}
const unavailable = () =>
  new DomainException(
    9001,
    "Không thể truy cập kho phiên đăng nhập. Vui lòng thử lại sau.",
    503,
  );
function decode(value: unknown): StoredSession | undefined {
  if (!value || typeof value !== "object") return;
  const row = value as StoredSession;
  if (
    typeof row.accountId !== "string" ||
    !/^\d+$/.test(row.accountId) ||
    typeof row.fingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(row.fingerprint) ||
    !Number.isSafeInteger(row.expires)
  )
    return;
  return row;
}

// Local, single-process compatibility. Never used as a serverless fallback.
export class FileSessionStore implements SessionStore {
  constructor(private readonly path: string) {}
  private load(): Record<string, StoredSession> {
    if (!existsSync(this.path)) return {};
    const rows = JSON.parse(readFileSync(this.path, "utf8"));
    return Object.fromEntries(
      Object.entries(rows).filter(([, value]) => {
        const session = decode(value);
        return session && session.expires > Date.now();
      }),
    ) as Record<string, StoredSession>;
  }
  private save(rows: Record<string, StoredSession>) {
    mkdirSync(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    writeFileSync(temporary, JSON.stringify(rows), { mode: 0o600 });
    renameSync(temporary, this.path);
  }
  async get(hash: string) {
    try {
      return this.load()[hash];
    } catch {
      throw unavailable();
    }
  }
  async set(hash: string, session: StoredSession) {
    try {
      this.save({ ...this.load(), [hash]: session });
    } catch {
      throw unavailable();
    }
  }
  async delete(hash: string) {
    try {
      const rows = this.load();
      delete rows[hash];
      this.save(rows);
    } catch {
      throw unavailable();
    }
  }
}

type RedisCommand = (string | number)[];
class SharedSessionStore implements SessionStore {
  constructor(
    private readonly command: (args: RedisCommand) => Promise<unknown>,
    private readonly prefix: string,
    readonly close?: () => void,
  ) {}
  async get(hash: string) {
    try {
      const value = await this.command(["GET", this.prefix + hash]);
      return value === null ? undefined : decode(JSON.parse(String(value)));
    } catch {
      throw unavailable();
    }
  }
  async set(hash: string, session: StoredSession) {
    const ttl = session.expires - Date.now();
    if (ttl <= 0) throw unavailable();
    try {
      if (
        (await this.command([
          "SET",
          this.prefix + hash,
          JSON.stringify(session),
          "PX",
          ttl,
        ])) !== "OK"
      )
        throw unavailable();
    } catch {
      throw unavailable();
    }
  }
  async delete(hash: string) {
    try {
      await this.command(["DEL", this.prefix + hash]);
    } catch {
      throw unavailable();
    }
  }
}

export function createSessionStore(
  env: NodeJS.ProcessEnv = process.env,
): SessionStore {
  const mode = env.SESSION_STORE || (env.VERCEL ? "redis" : "file");
  if (mode === "file" && !env.VERCEL) {
    return new FileSessionStore(
      resolve(
        env.SESSION_FILE ||
          resolve(__dirname, "../../../../.data/sessions.json"),
      ),
    );
  }
  const prefix = env.SESSION_KEY_PREFIX || "mayday:session:v1:";
  const restUrl = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const restToken = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (mode === "redis" && restUrl && restToken) {
    return new SharedSessionStore(async (args) => {
      if (new URL(restUrl).protocol !== "https:") throw unavailable();
      const response = await fetch(restUrl.replace(/\/+$/, ""), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${restToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(5000),
      });
      const body = (await response.json()) as {
        result?: unknown;
        error?: unknown;
      };
      if (!response.ok || body.error || !("result" in body))
        throw unavailable();
      return body.result;
    }, prefix);
  }
  if (mode === "redis" && env.REDIS_URL && !restUrl && !restToken) {
    const redis = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      connectTimeout: 5000,
      commandTimeout: 5000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    redis.on("error", () => {
      /* Errors are translated to a sanitized 503 at the request boundary. */
    });
    let connecting: Promise<void> | undefined;
    return new SharedSessionStore(
      async (args) => {
        if (redis.status === "wait" || redis.status === "end") {
          connecting ??= redis.connect().finally(() => {
            connecting = undefined;
          });
        }
        if (connecting) await connecting;
        return redis.call(String(args[0]), ...args.slice(1));
      },
      prefix,
      () => redis.disconnect(),
    );
  }
  // Do not issue tokens which only exist in one Vercel instance's /tmp.
  const missing = async (): Promise<never> => {
    throw new DomainException(
      9001,
      "Kho phiên dùng chung chưa được cấu hình. Quản trị viên cần kết nối Redis cho API.",
      503,
    );
  };
  return { get: missing, set: missing, delete: missing };
}
