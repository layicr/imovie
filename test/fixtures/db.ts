import { createClient, type Client } from "@libsql/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { invalidateFacets } from "@/lib/queries";

export interface SeedItem {
  item_id: string;
  media_type: "movie" | "tv";
  title: string;
  original_title?: string | null;
  year?: number | null;
  poster_path?: string | null;
  overview?: string | null;
  director?: string | null;
  writer?: string | null;
  cast?: string | null;
  genres?: string | null;
  country?: string | null;
  language?: string | null;
  release_date?: string | null;
  runtime?: number | null;
  aka?: string | null;
  imdb_id?: string | null;
  douban_id?: string | null;
  tmdb_id?: number | null;
  douban_rating?: number | null;
  tmdb_rating?: number | null;
}

export interface SeedRecord {
  item_id: string;
  status: "plan" | "watched";
  rating?: number | null;
  tags?: string | null;
  watched_at?: string | null;
  created_at?: string | null;
}

// 执行 data/schema.sql 建表（与 lib/db.ts 的 applySchema 逻辑一致），避免重复维护 DDL。
async function applySchema(db: Client): Promise<void> {
  const schema = readFileSync(join(process.cwd(), "data", "schema.sql"), "utf-8");
  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const st of statements) {
    await db.execute(st + ";");
  }
}

/**
 * 建一个独立的 :memory: 库并灌入造数据，供功能测试断言精确结果。
 * 每次调用都是全新实例，天然隔离；并在建表后重置模块级 facets 缓存，避免跨用例串扰。
 */
export async function setupTestDb(
  items: SeedItem[],
  records: SeedRecord[] = []
): Promise<Client> {
  const db = createClient({ url: ":memory:" });
  await applySchema(db);
  invalidateFacets();

  for (const it of items) {
    await db.execute({
      sql: `INSERT INTO imovie_items (
        item_id, media_type, title, original_title, year, poster_path, overview,
        director, writer, cast, genres, country, language, release_date, runtime,
        aka, imdb_id, douban_id, tmdb_id, douban_rating, tmdb_rating
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )`,
      args: [
        it.item_id,
        it.media_type,
        it.title,
        it.original_title ?? null,
        it.year ?? null,
        it.poster_path ?? null,
        it.overview ?? null,
        it.director ?? null,
        it.writer ?? null,
        it.cast ?? null,
        it.genres ?? null,
        it.country ?? null,
        it.language ?? null,
        it.release_date ?? null,
        it.runtime ?? null,
        it.aka ?? null,
        it.imdb_id ?? null,
        it.douban_id ?? null,
        it.tmdb_id ?? null,
        it.douban_rating ?? null,
        it.tmdb_rating ?? null,
      ],
    });
  }

  for (const r of records) {
    await db.execute({
      sql: `INSERT INTO imovie_records (
        user_id, item_id, status, rating, tags, watched_at, created_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?)`,
      args: [
        r.item_id,
        r.status,
        r.rating ?? null,
        r.tags ?? null,
        r.watched_at ?? null,
        r.created_at ?? null,
      ],
    });
  }

  return db;
}
