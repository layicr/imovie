import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createClient, type Client } from "@libsql/client";

import {
  __setDb,
  existingItemIds,
  upsertItem,
  rebuildRecords,
  parseSubjectPage,
  hasVal,
  buildRow,
  fillFromTmdb,
  fillFromDoubanPage,
  ITEM_COLS,
  RECORD_COLS,
  USER_ID,
  type Row,
  type DoubanEntry,
} from "../2-douban_import.ts";

const ROOT = path.resolve(__dirname, "..");
const PROD_DIR = path.join(ROOT, "20260816");
const SRC_DIR = path.join(ROOT, "20260815");

// 自动匹配生产库文件名（含中文），避免 shell 编码问题
function findProdDb(): string {
  const f = fs.readdirSync(PROD_DIR).find((x) => x.startsWith("local.db"));
  if (!f) throw new Error("未找到生产库，请确认 20260816/ 目录");
  return path.join(PROD_DIR, f);
}
function findJson(name: string): string {
  const p = path.join(SRC_DIR, name);
  if (!fs.existsSync(p)) throw new Error(`未找到 ${name}`);
  return p;
}

// 复制生产库为独立测试库，返回已打开的 libSQL client
function openTestDb(): Client {
  const tmp = path.join(os.tmpdir(), `imovie_test_${Date.now()}_${Math.random().toString(36).slice(2)}.db`);
  fs.copyFileSync(findProdDb(), tmp);
  const c = createClient({ url: `file:${tmp}` });
  return c;
}

// 构造一条基础 Row（只填必需字段，其余空）
function makeRow(over: Partial<Row>): Row {
  return {
    item_id: "",
    media_type: "movie",
    title: "",
    original_title: null,
    year: null,
    poster_path: null,
    overview: null,
    director: null,
    writer: null,
    cast: null,
    genres: null,
    country: null,
    language: null,
    release_date: null,
    runtime: null,
    aka: null,
    imdb_id: null,
    douban_id: null,
    tmdb_id: null,
    douban_rating: null,
    tmdb_rating: null,
    status: "watched",
    rating: null,
    tags: null,
    watched_at: null,
    ...over,
  } as Row;
}

// 构造一条基础 DoubanEntry（buildRow 测试用）
function makeEntry(
  subjectOver: Record<string, unknown> = {},
  entryOver: Partial<DoubanEntry> = {}
): DoubanEntry {
  return {
    id: 1,
    status: "done",
    rating: null,
    create_time: "2026-08-11 21:53:52",
    subject: {
      id: "36680667",
      title: "测试片",
      year: "2026",
      type: "movie",
      directors: [],
      actors: [],
      genres: [],
      ...subjectOver,
    } as DoubanEntry["subject"],
    ...entryOver,
  };
}

// 取生产 json 中第一条 done 的 item_id（库内已存在）
function sampleExistingId(): string {
  const done = JSON.parse(fs.readFileSync(findJson("movie_done.json"), "utf-8"));
  return String(done[0].subject.id);
}

let client: Client;

before(async () => {
  client = openTestDb();
  __setDb(client);
});

after(async () => {
  try { await client.close(); } catch { /* ignore */ }
});

// ---------------------------------------------------------------------------
test("hasVal: 空值判定", () => {
  assert.equal(hasVal(null), false);
  assert.equal(hasVal(undefined), false);
  assert.equal(hasVal(""), false);
  assert.equal(hasVal(0), true);
  assert.equal(hasVal(" "), true);
  assert.equal(hasVal("abc"), true);
});

// ---------------------------------------------------------------------------
test("existingItemIds: 能读出库内已有的 item_id", async () => {
  const set = await existingItemIds();
  assert.ok(set instanceof Set);
  assert.ok(set.has(sampleExistingId()), "应包含样本已存在 item_id");
  assert.ok(set.size > 0, "库内应有数据");
});

// ---------------------------------------------------------------------------
test("upsertItem 已存在: 仅非空字段覆盖，空字段保留原值", async () => {
  const id = sampleExistingId();
  // 先读原值
  const before = await client.execute({
    sql: "SELECT title, overview, director FROM imovie_items WHERE item_id = @id",
    args: { "@id": id },
  });
  const orig = before.rows[0] as unknown as { title: string; overview: unknown; director: unknown };

  const r = makeRow({
    item_id: id,
    title: "覆盖测试标题",
    director: "覆盖测试导演",
    // overview 故意留空 -> 不应被清空
  });
  await upsertItem(r, true);

  const after = await client.execute({
    sql: "SELECT title, overview, director, updated_at FROM imovie_items WHERE item_id = @id",
    args: { "@id": id },
  });
  const now = after.rows[0] as unknown as {
    title: string;
    overview: unknown;
    director: string;
    updated_at: string;
  };

  assert.equal(now.title, "覆盖测试标题", "title 应被覆盖");
  assert.equal(now.director, "覆盖测试导演", "director 应被覆盖");
  assert.equal(now.overview, orig.overview, "overview 为空时不更新，保留原值");
  assert.ok(now.updated_at, "updated_at 应被刷新");
});

// ---------------------------------------------------------------------------
test("upsertItem 新增: 插入整行且 item_id 为字符串(无 .0)", async () => {
  const id = "99999999";
  const r = makeRow({
    item_id: id,
    title: "测试新增影片",
    media_type: "movie",
    douban_id: id,
    douban_rating: 8.5,
  });
  await upsertItem(r, false);

  const res = await client.execute({
    sql: "SELECT item_id, title, douban_rating FROM imovie_items WHERE item_id = @id",
    args: { "@id": id },
  });
  assert.equal(res.rows.length, 1, "应插入 1 条");
  assert.equal(res.rows[0].item_id, id, "item_id 应为字符串 99999999");
  assert.equal(res.rows[0].title, "测试新增影片");
  assert.equal(res.rows[0].douban_rating, 8.5);

  // 不应出现浮点型 item_id
  const bad = await client.execute({
    sql: "SELECT count(*) AS n FROM imovie_items WHERE item_id = '99999999.0'",
  });
  assert.equal((bad.rows[0] as unknown as { n: number }).n, 0, "不应出现 99999999.0");
});

// ---------------------------------------------------------------------------
test("rebuildRecords: 删除本次 item_id 的 records 后重插，保留其他历史", async () => {
  // 选两个库内已存在的 item_id
  const ids = (await existingItemIds());
  const arr = Array.from(ids).slice(0, 3);
  assert.ok(arr.length >= 2, "库内数据不足，无法测试");

  const [a, b] = arr;
  const keepId = arr[arr.length - 1]; // 不在本次批次的“其他历史”

  // 先清掉 keepId 原有记录，再插一条“其他历史” record（模拟非本次批次的数据）
  await client.execute({
    sql: "DELETE FROM imovie_records WHERE user_id = @u AND item_id = @i",
    args: { "@u": USER_ID, "@i": keepId },
  });
  await client.execute({
    sql: "INSERT INTO imovie_records (user_id, item_id, status, rating, tags, watched_at, created_at) VALUES (@u, @i, 'plan', NULL, NULL, NULL, datetime('now'))",
    args: { "@u": USER_ID, "@i": keepId },
  });

  const rows: Row[] = [
    makeRow({ item_id: a, status: "watched", rating: 9, tags: "科幻" }),
    makeRow({ item_id: b, status: "plan", rating: null, tags: "" }),
  ];

  await rebuildRecords(rows);

  // a/b 应各有 1 条（重建后）
  for (const id of [a, b]) {
    const cnt = await client.execute({
      sql: "SELECT count(*) AS n FROM imovie_records WHERE item_id = @i AND user_id = @u",
      args: { "@i": id, "@u": USER_ID },
    });
    assert.equal((cnt.rows[0] as unknown as { n: number }).n, 1, `item ${id} 应有 1 条 record`);
  }
  // a 的 rating 应为 9
  const aRec = await client.execute({
    sql: "SELECT rating, status FROM imovie_records WHERE item_id = @i AND user_id = @u",
    args: { "@i": a, "@u": USER_ID },
  });
  assert.equal((aRec.rows[0] as unknown as { rating: number }).rating, 9);
  assert.equal((aRec.rows[0] as unknown as { status: string }).status, "watched");

  // keepId 的历史记录应被保留
  const keepCnt = await client.execute({
    sql: "SELECT count(*) AS n FROM imovie_records WHERE item_id = @i AND user_id = @u",
    args: { "@i": keepId, "@u": USER_ID },
  });
  assert.equal((keepCnt.rows[0] as unknown as { n: number }).n, 1, "其他历史记录应保留");
});

// ---------------------------------------------------------------------------
test("rebuildRecords: 空输入不报错", async () => {
  await assert.doesNotReject(() => rebuildRecords([]));
});

// ---------------------------------------------------------------------------
test("parseSubjectPage: 解析豆瓣影片页关键字段", () => {
  const html = `
  <div id="info">
    <span><span class="pl">导演</span>: 文牧野</span><br/>
    <span><span class="pl">编剧</span>: 文牧野 / 郎群力 / 钟伟</span><br/>
    <span><span class="pl">主演</span>: 沈腾 / 蒋奇明 / 奥马尔·谢里夫 / 更多...</span><br/>
    <span><span class="pl">类型</span>: 剧情 / 战争</span><br/>
    <span><span class="pl">制片国家/地区</span>: 中国大陆</span><br/>
    <span><span class="pl">语言</span>: 汉语普通话 / 阿拉伯语 / 英语</span><br/>
    <span><span class="pl">上映日期</span>: 2026-08-11(中国大陆)</span><br/>
    <span><span class="pl">片长</span>: 140分钟</span><br/>
    <span><span class="pl">又名</span>: Once Upon a Time in the Middle East / 更多...</span><br/>
    <a href="https://www.imdb.com/title/tt34386754/">IMDb</a>
    <span property="v:summary">这是个测试简介，包含换行
    第二行。</span>
  </div>`;

  const r = parseSubjectPage(html);
  assert.equal(r.director, "文牧野");
  assert.equal(r.writer, "文牧野 / 郎群力 / 钟伟");
  assert.equal(r.cast, "沈腾 / 蒋奇明 / 奥马尔·谢里夫");
  assert.equal(r.genres, "剧情 / 战争");
  assert.equal(r.country, "中国大陆");
  assert.equal(r.language, "汉语普通话 / 阿拉伯语 / 英语");
  assert.equal(r.release_date, "2026-08-11");
  assert.equal(r.runtime, 140);
  assert.equal(r.aka, "Once Upon a Time in the Middle East");
  assert.equal(r.imdb_id, "tt34386754");
  assert.ok(r.overview && r.overview.includes("测试简介"));
});

// ---------------------------------------------------------------------------
test("parseSubjectPage: 字段缺失时返回空", () => {
  const r = parseSubjectPage("<div id='info'></div>");
  assert.equal(r.director, undefined);
  assert.equal(r.genres, undefined);
  assert.equal(r.imdb_id, undefined);
});

// ---------------------------------------------------------------------------
test("buildRow: watched 条目字段映射完整", () => {
  const e = makeEntry(
    {
      id: 36680667, // 故意用数字，验证 item_id 被转成字符串
      title: "测试片",
      original_title: "Test Film",
      year: "2026",
      type: "movie",
      directors: [{ name: "文牧野" }],
      actors: [{ name: "沈腾" }, { name: "蒋奇明" }],
      genres: ["剧情", "战争"],
      rating: { value: 8.5, max: 10 },
      pubdate: ["2026-08-11(中国大陆)"],
    },
    { rating: { value: 4, max: 10 } }
  );
  const r = buildRow(e, "watched");

  assert.equal(r.item_id, "36680667", "item_id 应为字符串");
  assert.equal(r.douban_id, "36680667");
  assert.equal(r.media_type, "movie");
  assert.equal(r.title, "测试片");
  assert.equal(r.original_title, "Test Film");
  assert.equal(r.year, 2026);
  assert.equal(r.director, "文牧野");
  assert.equal(r.cast, "沈腾 / 蒋奇明");
  assert.equal(r.genres, "剧情 / 战争");
  assert.equal(r.tags, "剧情 / 战争", "tags 默认取 genres");
  assert.equal(r.release_date, "2026-08-11");
  assert.equal(r.douban_rating, 8.5);
  assert.equal(r.rating, 8, "用户评分 value 4 → 4*2=8");
  assert.equal(r.status, "watched");
  assert.equal(r.watched_at, "2026-08-11", "watched_at 取 create_time 的日期部分");
});

// ---------------------------------------------------------------------------
test("buildRow: plan 条目 watched_at 为空", () => {
  const r = buildRow(makeEntry({}, { rating: null }), "plan");
  assert.equal(r.status, "plan");
  assert.equal(r.watched_at, null);
  assert.equal(r.rating, null);
});

// ---------------------------------------------------------------------------
test("buildRow: 用户评分钳制到 1~10", () => {
  const mk = (v: number | null) =>
    buildRow(makeEntry({}, { rating: v === null ? null : { value: v, max: 10 } }), "watched").rating;
  assert.equal(mk(5), 10, "5 星封顶为 10");
  assert.equal(mk(0.4), 1, "过低保底为 1");
  assert.equal(mk(0), null, "0 视为未评分");
  assert.equal(mk(4.7), 9, "4.7*2=9.4 四舍五入为 9");
  assert.equal(mk(null), null);
});

// ---------------------------------------------------------------------------
test("buildRow: tv 类型判定（type 或 subtype 为 tv）", () => {
  assert.equal(buildRow(makeEntry({ type: "tv" }), "plan").media_type, "tv");
  assert.equal(buildRow(makeEntry({ type: "movie", subtype: "tv" }), "plan").media_type, "tv");
  assert.equal(buildRow(makeEntry({ type: "movie" }), "plan").media_type, "movie");
});

// ---------------------------------------------------------------------------
test("buildRow: 多种日期格式归一化", () => {
  assert.equal(buildRow(makeEntry({ pubdate: ["2026年8月11日"] }), "plan").release_date, "2026-08-11");
  assert.equal(buildRow(makeEntry({ pubdate: ["2026-08"] }), "plan").release_date, "2026-08-01");
  assert.equal(buildRow(makeEntry({ pubdate: ["2026"] }), "plan").release_date, "2026-01-01");
  assert.equal(
    buildRow(makeEntry({ pubdate: undefined, release_date: "2025-12-31" }), "plan").release_date,
    "2025-12-31",
    "pubdate 缺失时回退 subject.release_date"
  );
  assert.equal(buildRow(makeEntry({ pubdate: undefined, release_date: null }), "plan").release_date, null);
  assert.equal(buildRow(makeEntry({ year: undefined }), "plan").year, null);
});

// ---------------------------------------------------------------------------
test("upsertItem: overview 换行折叠为单行", async () => {
  const id = "t-ov";
  await client.execute({ sql: "DELETE FROM imovie_items WHERE item_id = @id", args: { "@id": id } });
  await upsertItem(
    makeRow({ item_id: id, title: "简介折叠", douban_id: id, overview: "第一行\n第二行\r\n第三行" }),
    false
  );
  const res = await client.execute({
    sql: "SELECT overview FROM imovie_items WHERE item_id = @id",
    args: { "@id": id },
  });
  assert.equal(res.rows[0].overview, "第一行 第二行 第三行", "换行应折叠为空格");
});

// ---------------------------------------------------------------------------
test("upsertItem: 数值 0 视为有值（会覆盖原值）", async () => {
  const id = "t-zero";
  await client.execute({ sql: "DELETE FROM imovie_items WHERE item_id = @id", args: { "@id": id } });
  await upsertItem(makeRow({ item_id: id, title: "零分测试", douban_id: id, douban_rating: 8.5 }), false);
  await upsertItem(makeRow({ item_id: id, douban_rating: 0 }), true);
  const res = await client.execute({
    sql: "SELECT douban_rating, title FROM imovie_items WHERE item_id = @id",
    args: { "@id": id },
  });
  assert.equal(res.rows[0].douban_rating, 0, "douban_rating 应被覆盖为 0");
  assert.equal(res.rows[0].title, "零分测试", "空 title 不覆盖");
});

// ---------------------------------------------------------------------------
test("rebuildRecords: 不影响其他 user_id 的记录", async () => {
  const id = "t-rec-other-user";
  await client.execute({ sql: "DELETE FROM imovie_records WHERE item_id = @i", args: { "@i": id } });
  await client.execute({
    sql: "INSERT INTO imovie_records (user_id, item_id, status, created_at) VALUES (2, @i, 'watched', datetime('now'))",
    args: { "@i": id },
  });

  await rebuildRecords([makeRow({ item_id: id, status: "plan" })]);

  const u1 = await client.execute({
    sql: "SELECT count(*) AS n, max(status) AS s FROM imovie_records WHERE item_id = @i AND user_id = @u",
    args: { "@i": id, "@u": USER_ID },
  });
  assert.equal((u1.rows[0] as unknown as { n: number }).n, 1, "本用户应有 1 条重建记录");
  assert.equal((u1.rows[0] as unknown as { s: string }).s, "plan");

  const u2 = await client.execute({
    sql: "SELECT count(*) AS n FROM imovie_records WHERE item_id = @i AND user_id = 2",
    args: { "@i": id },
  });
  assert.equal((u2.rows[0] as unknown as { n: number }).n, 1, "其他用户的记录应保留");
});

// ---------------------------------------------------------------------------
test("rebuildRecords: item_id 为空的行被跳过", async () => {
  await assert.doesNotReject(() => rebuildRecords([makeRow({ item_id: "" })]));
});

// ---------------------------------------------------------------------------
test("parseSubjectPage: all hidden 简介与裸 IMDb 号回退", () => {
  const html = `<div id="info"></div><span class="all hidden">隐藏的完整简介。</span><div>tt12345678</div>`;
  const r = parseSubjectPage(html);
  assert.equal(r.overview, "隐藏的完整简介。");
  assert.equal(r.imdb_id, "tt12345678");
});

// ---------------------------------------------------------------------------
test("parseSubjectPage: 片长取首个数字、又名去除尾部更多", () => {
  const html = `
  <div id="info">
    <span><span class="pl">导演</span>: 文牧野 / 更多...</span><br/>
    <span><span class="pl">片长</span>: 45分钟/集</span><br/>
    <span><span class="pl">又名</span>: 别名A / 别名B / 更多...</span><br/>
  </div>`;
  const r = parseSubjectPage(html);
  assert.equal(r.director, "文牧野");
  assert.equal(r.runtime, 45);
  assert.equal(r.aka, "别名A / 别名B");
});

// ---------------------------------------------------------------------------
test("fillFromTmdb: 搜索+详情成功，补全各字段", async (t) => {
  const resp = (data: unknown) => ({ ok: true, json: async () => data }) as unknown as Response;
  t.mock.method(globalThis, "fetch", async (input: unknown) => {
    const url = String(input);
    if (url.includes("/search/movie")) {
      return resp({
        results: [{ id: 550, poster_path: "/p.jpg", vote_average: 8.44, original_title: "Fight Club" }],
      });
    }
    if (url.includes("/alternative_titles")) {
      return resp({
        titles: [
          { title: "搏击俱乐部", iso_3166_1: "CN" },
          { title: "Fight Club", iso_3166_1: "US" },
          { title: "French Alias", iso_3166_1: "FR" }, // 非中/英/原产区，应被过滤
        ],
      });
    }
    if (url.includes("/keywords")) {
      return resp({ keywords: [{ name: "revenge" }, { name: "fight" }] });
    }
    // 详情接口
    return resp({
      id: 550,
      poster_path: "/p2.jpg",
      vote_average: 8.4,
      original_title: "Fight Club",
      original_language: "en",
      overview: "简介文本",
      release_date: "1999-10-15",
      runtime: 139,
      origin_country: ["US"],
      imdb_id: "tt0137523",
      credits: {
        crew: [
          { name: "Jim Uhls", department: "Writing" },
          { name: "David Fincher", department: "Directing" },
        ],
      },
    });
  });

  const row = makeRow({ item_id: "t-tmdb-1", title: "搏击俱乐部", year: 1999, tags: "剧情" });
  const ok = await fillFromTmdb(row);

  assert.equal(ok, true);
  assert.equal(row.tmdb_id, 550);
  assert.equal(row.poster_path, "/p2.jpg", "详情 poster 覆盖搜索 poster");
  assert.equal(row.tmdb_rating, 8.4, "vote_average 保留 1 位小数");
  assert.equal(row.original_title, "Fight Club");
  assert.equal(row.language, "en");
  assert.equal(row.overview, "简介文本");
  assert.equal(row.release_date, "1999-10-15");
  assert.equal(row.runtime, 139);
  assert.equal(row.country, "US");
  assert.equal(row.imdb_id, "tt0137523");
  assert.equal(row.writer, "Jim Uhls", "仅取 Writing 部门");
  assert.equal(row.aka, "搏击俱乐部 / Fight Club", "又名仅保留中文/英文区");
  assert.equal(row.tags, "剧情 / revenge / fight", "keywords 合并进 tags 并去重");
});

// ---------------------------------------------------------------------------
test("fillFromTmdb: 搜索无结果返回 false", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    return { ok: true, json: async () => ({ results: [] }) } as unknown as Response;
  });
  const row = makeRow({ item_id: "t-tmdb-2", title: "不存在的片" });
  const ok = await fillFromTmdb(row);
  assert.equal(ok, false);
  assert.equal(row.tmdb_id, null);
});

// ---------------------------------------------------------------------------
test("fillFromTmdb: 网络异常返回 false 不抛出", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("network down");
  });
  const row = makeRow({ item_id: "t-tmdb-3", title: "网络异常片" });
  const ok = await fillFromTmdb(row);
  assert.equal(ok, false);
  assert.equal(row.tmdb_id, null);
});

// ---------------------------------------------------------------------------
test("fillFromTmdb: 详情失败仍返回 true（保留搜索结果）", async (t) => {
  const resp = (data: unknown) => ({ ok: true, json: async () => data }) as unknown as Response;
  t.mock.method(globalThis, "fetch", async (input: unknown) => {
    const url = String(input);
    if (url.includes("/search/movie")) {
      return resp({
        results: [{ id: 551, poster_path: "/p.jpg", vote_average: 7.25, original_title: "Some Film" }],
      });
    }
    throw new Error("details down");
  });
  const row = makeRow({ item_id: "t-tmdb-4", title: "详情失败片" });
  const ok = await fillFromTmdb(row);
  assert.equal(ok, true, "拿到 tmdb_id 即视为成功");
  assert.equal(row.tmdb_id, 551);
  assert.equal(row.tmdb_rating, 7.3, "搜索阶段评分四舍五入");
  assert.equal(row.poster_path, "/p.jpg");
  assert.equal(row.overview, null, "详情失败时 overview 留空");
});

// ---------------------------------------------------------------------------
test("fillFromDoubanPage: 仅补全空字段，已有值不覆盖", async (t) => {
  const html = `
  <div id="info">
    <span><span class="pl">导演</span>: 文牧野</span><br/>
    <span><span class="pl">类型</span>: 剧情 / 战争</span><br/>
  </div>`;
  t.mock.method(globalThis, "fetch", async () => {
    return { ok: true, text: async () => html } as unknown as Response;
  });
  const row = makeRow({ item_id: "t-scrape", director: "", genres: "动作" });
  await fillFromDoubanPage(row);
  assert.equal(row.director, "文牧野", "空字段应被豆瓣页补全");
  assert.equal(row.genres, "动作", "已有值不应被覆盖");
});

// ---------------------------------------------------------------------------
test("fillFromDoubanPage: 抓取失败不抛出，行保持不变", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("HTTP 403");
  });
  const row = makeRow({ item_id: "t-scrape-fail", director: "" });
  await assert.doesNotReject(() => fillFromDoubanPage(row));
  assert.equal(row.director, "");
});

// ---------------------------------------------------------------------------
test("ITEM_COLS / RECORD_COLS 包含关键列", () => {
  for (const c of ["item_id", "title", "tmdb_id", "douban_rating", "updated_at"]) {
    assert.ok(ITEM_COLS.includes(c), `ITEM_COLS 应含 ${c}`);
  }
  for (const c of ["user_id", "item_id", "status", "watched_at"]) {
    assert.ok(RECORD_COLS.includes(c), `RECORD_COLS 应含 ${c}`);
  }
});
