// lib/db.ts — 数据库连接单例。 / Database connection singleton.
// 职责：统一管理 libSQL 连接、幂等建表，并透明处理两种部署形态：
// Responsibility: unify libSQL connection and idempotent schema creation, transparently handling two deploy shapes:
//   1) 本地/文件模式  file:./data/local.db —— 解析绝对路径、建 data 目录、
//      1) Local/file mode  file:./data/local.db — resolve absolute path, create data dir,
//      在 Serverless 只读 FS(如 Vercel /var/task)上复制到 /tmp 后打开。
//      and on a Serverless read-only FS (e.g. Vercel /var/task) copy to /tmp before opening.
//   2) 远程模式      libsql://<实例>.turso.io —— 直接交给 @libsql/client。
//   2) Remote mode   libsql://<instance>.turso.io — handed straight to @libsql/client.
// 业务层只通过 getDb() 取连接，无需关心底层是本地还是远程；切换只看 DATABASE_URL。
// The app only calls getDb(); it never cares whether the backend is local or remote — switch via DATABASE_URL alone.
import { createClient, type Client } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

// 数据库连接信息：本地默认 file:./data/local.db，生产可切到 Turso 远程实例(libsql://)。
// DB connection info: local default file:./data/local.db; production can switch to a Turso remote (libsql://).
// 业务代码无需感知差异——只要改 DATABASE_URL / TURSO_AUTH_TOKEN 即可。
// App code need not know the difference — just change DATABASE_URL / TURSO_AUTH_TOKEN.
const DB_URL = process.env.DATABASE_URL || "file:./data/local.db";
const AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN; // Turso 远程实例的鉴权令牌（本地文件模式留空） / Turso auth token (empty for local file mode).

let ready: Promise<Client> | null = null;
// 建表（applySchema）只执行一次的 Promise 缓存，与连接 Promise 解耦：
// The schema-apply Promise is cached to run once and decoupled from the connect Promise:
// 即使 connect 失败重置了 ready，已成功的建表也不会重跑；且并发请求只建一次表。
// even if connect fails and resets ready, a successful schema apply won't rerun; concurrent requests build the table only once.
let schemaReady: Promise<void> | null = null;

// 首次连接时根据 schema.sql 自动建表，保证「拉下来即可跑」。
// Auto-create tables from schema.sql on first connect, so it "just runs" after checkout.
// 本地文件模式(file:)负责：解析绝对路径、创建 data 目录、处理 Serverless 只读文件
// Local file mode (file:) resolves the absolute path, creates the data dir, and handles a Serverless read-only FS
// 系统（复制到 /tmp 后打开）；远程模式(libsql://)则直接交给 @libsql/client。
// (copy to /tmp before opening); remote mode (libsql://) is handed to @libsql/client directly.
async function connect(): Promise<Client> {
  let url = DB_URL;

  // 本地文件模式：解析为绝对路径并提前创建 data 目录，避免 cwd 变化导致建表失败。
  // Local file mode: resolve to an absolute path and create the data dir early to avoid cwd-related failures.
  if (DB_URL.startsWith("file:")) {
    const file = DB_URL.slice("file:".length);
    const abs = path.isAbsolute(file) ? file : path.resolve(/*turbopackIgnore: true*/ process.cwd(), file);
    fs.mkdirSync(path.dirname(abs), { recursive: true });

    // Vercel 等 Serverless 运行期 /var/task 为只读文件系统，libsql 默认以可写
    // On Serverless runtimes like Vercel, /var/task is read-only; libsql opens in writable mode by default and tries
    // 模式打开会尝试创建 journal/WAL 文件而连接失败。将打包进来的只读 db 复制到
    // to create journal/WAL files, which fails. Copy the bundled read-only db into the writable
    // 可写的 /tmp/local.db 后再打开，即可正常 SELECT（只读展示站无需真实写入）。
    // /tmp/local.db and open that, so SELECT works (a read-only display site needs no real writes).
    // 优化：仅当 /tmp 副本缺失或大小与源不一致时才复制（warm 实例复用、源未变则
    // Optimization: copy only when the /tmp copy is missing or differs in size from the source (warm instances reuse,
    // 跳过），避免每次冷启动重复拷贝几 MB 的库。
    // skip when unchanged) to avoid re-copying a multi-MB db on every cold start.
    // 跨平台回退：本地 Windows/macOS 若无 /tmp 或不可写，stat/copyFile 抛错则回退
    // Cross-platform fallback: on local Windows/macOS without a writable /tmp, stat/copyFile throws and we fall back
    // 直接打开原路径（abs），本地可写环境本就无需复制，无副作用。
    // to opening the original path (abs); a writable local env never needed the copy, so no side effects.
    let openPath = abs;
    const tmpPath = path.join("/tmp", "local.db");
    try {
      // 确保 /tmp 可写目录存在（个别 Serverless 运行时需显式创建，幂等无副作用）。
      // Ensure the writable /tmp dir exists (some Serverless runtimes need it created explicitly; idempotent).
      fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
      const srcStat = await fs.promises.stat(abs);
      let needCopy = true;
      try {
        const dstStat = await fs.promises.stat(tmpPath);
        if (dstStat.size === srcStat.size) needCopy = false;
      } catch {
        // /tmp 副本不存在，需要复制 / /tmp copy absent → needs copy.
      }
      if (needCopy) await fs.promises.copyFile(abs, tmpPath);
      openPath = tmpPath;
    } catch {
      // 复制路径失败时回退直接打开源（如本地可写环境本就无需复制），由后续建连接暴露真实错误。
      // On copy failure, fall back to opening the source directly (e.g. a writable local env); later connect surfaces the real error.
      openPath = abs;
    }
    url = `file:${openPath}`;
  }

  const client = createClient({ url, authToken: AUTH_TOKEN });
  await getSchemaReady(client);
  return client;
}

/** 对数据库 URL 做脱敏，用于日志/错误信息，避免泄露 token 或绝对路径。 */
/** Mask the database URL for logs/errors so tokens or absolute paths are never leaked. */
function maskDbUrl(url: string): string {
  try {
    // libsql 客户端支持 https://...?authToken=... 这类 URL
    // The libsql client supports URLs like https://...?authToken=...
    if (url.includes("?")) {
      const u = new URL(url);
      if (u.searchParams.has("authToken")) {
        u.searchParams.set("authToken", "***");
      }
      return u.toString();
    }
    // 本地 file: 路径只保留末两级目录 + 文件名，既能定位又避免泄露完整绝对路径
    // For a local file: path, keep only the last two dir segments + file name — enough to locate, but not the full absolute path.
    if (url.startsWith("file:")) {
      const file = url.slice("file:".length);
      const dir = path.dirname(file);
      const tail = path.basename(dir);
      return `file:…/${tail}/${path.basename(file)}`;
    }
    return url;
  } catch {
    return "<database-url>";
  }
}

// 读取 schema.sql 并按语句顺序执行建表（幂等，CREATE TABLE IF NOT EXISTS）。
// Read schema.sql and run the CREATE statements in order (idempotent via CREATE TABLE IF NOT EXISTS).
// 执行结果由 schemaReady 缓存，保证整个进程生命周期内仅跑一次。
// The result is cached in schemaReady so it runs at most once per process.
// 优化：库已含目标表时直接短路，跳过逐条建表往返（冷启动提速，尤其 Vercel 打包库场景）。
// Optimization: short-circuit when the target table already exists, skipping per-statement round-trips (faster cold starts, esp. Vercel bundled db).
async function applySchema(client: Client): Promise<void> {
  const probe = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='imovie_items'"
  );
  if (probe.rows.length > 0) return;

  const schema = fs.readFileSync(path.join(process.cwd(), "data", "schema.sql"), "utf-8");
  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const st of statements) {
    await client.execute(st + ";");
  }
}

function getSchemaReady(client: Client): Promise<void> {
  if (!schemaReady) {
    schemaReady = applySchema(client).catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

// 返回已初始化的数据库连接（仅初始化一次，缓存 Promise 防止并发重复建表）。
// Return an initialized DB connection (initialized once; the Promise is cached to avoid concurrent re-building).
// 若首次连接失败，重置 ready 以便下次请求可重试，避免永久复用 rejected Promise。
// On first-connect failure, reset ready so the next request can retry instead of permanently reusing a rejected Promise.
export function getDb(): Promise<Client> {
  if (!ready) {
    ready = connect().catch((err: unknown) => {
      ready = null;
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`数据库连接失败 (${maskDbUrl(DB_URL)}): ${message}`);
    });
  }
  return ready;
}
