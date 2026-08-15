import { createClient, type Client } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

// 数据库连接信息：本地默认 file:./data/local.db，生产通过环境变量切换到 Turso 远程实例。
// 业务代码无需感知差异——只要改 DATABASE_URL / TURSO_AUTH_TOKEN 即可。
const DB_URL = process.env.DATABASE_URL || "file:./data/local.db";
const AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN; // Turso 远程实例的鉴权令牌（本地文件模式留空）

let ready: Promise<Client> | null = null;

// 首次连接时根据 schema.sql 自动建表，保证「拉下来即可跑」。
async function connect(): Promise<Client> {
  let url = DB_URL;

  // 本地文件模式：解析为绝对路径并提前创建 data 目录，避免 cwd 变化导致建表失败。
  if (DB_URL.startsWith("file:")) {
    const file = DB_URL.slice("file:".length);
    const abs = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    url = `file:${abs}`;
  }

  const client = createClient({ url, authToken: AUTH_TOKEN });
  await applySchema(client);
  return client;
}

// 读取 schema.sql 并按语句顺序执行建表（幂等，CREATE TABLE IF NOT EXISTS）。
async function applySchema(client: Client): Promise<void> {
  const schema = fs.readFileSync(path.join(process.cwd(), "data", "schema.sql"), "utf-8");
  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const st of statements) {
    await client.execute(st + ";");
  }
}

// 返回已初始化的数据库连接（仅初始化一次，缓存 Promise 防止并发重复建表）。
// 若首次连接失败，重置 ready 以便下次请求可重试，避免永久复用 rejected Promise。
export function getDb(): Promise<Client> {
  if (!ready) {
    ready = connect().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}
