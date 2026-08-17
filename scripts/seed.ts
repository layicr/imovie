/**
 * 测试数据填充脚本（seed）
 *
 * 用法（需先 pnpm/npm install）：
 *   DATABASE_URL=file:./data/local.db npx tsx scripts/seed.ts
 *
 * 设计依据：data/schema.sql 当前表结构
 *   - imovie_items：主键 item_id（TEXT PRIMARY KEY，影片唯一编号），额外持久化 tmdb_id / douban_id 作为外链拼接用途；
 *                    其余为业务元数据字段（标题/年份/类型/国家/导演等）。
 *   - imovie_records：id 自增主键；item_id 按应用层约定引用 imovie_items 主键（schema 未建物理外键，
 *                    仅外键语义，seed 会先校验影片存在再插入，靠应用层保证存在）；
 *                     UNIQUE(user_id, item_id) 约束同一用户同一影片不可重复；
 *                     status 仅 'plan'（想看）| 'watched'（已看），rating 仅 watched 时填 1-10。
 *
 * item_id 取值策略：item_id 直接等于 douban_id（如 1292052 / 3016187），
 * 既能稳定作为主键/外键，又天然带外链语义。所有 douban_id 均必须有值。
 * records 表按应用层约定引用该主键（非 SQL 外键），保证联表查询可正常 join。
 */

import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

const DB_URL = process.env.DATABASE_URL || "file:./data/local.db";

// --------------------------------------------------------------------------
// 影片元数据（写入 imovie_items，item_id 为 TEXT 主键）
// --------------------------------------------------------------------------
type ItemSeed = {
  item_id: string; // 主键：当前策略直接等于 douban_id（如 1292052），需全局唯一
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  original_title: string;
  year: number; // INTEGER
  poster_path: string;
  overview: string;
  director: string; // 多名以 / 分隔
  writer: string; // 多名以 / 分隔
  cast: string; // 多名以 / 分隔
  genres: string; // 以 / 分隔（兼容逗号、顿号，应用层拆分）
  country: string; // 制片国家/地区（ISO 3166-1 alpha-2 两位大写代码）
  language: string; // 语言（ISO 639-1 两位小写代码）
  release_date: string; // ISO，如 2011-04-17
  runtime: number | null; // 分钟；电视剧可空
  aka: string; // 又名（逗号分隔）
  imdb_id: string; // 如 tt0944947
  douban_id: string; // 如 1292052，详情页拼豆瓣外链
  douban_rating: number | null; // 豆瓣评分（可空）
  tmdb_rating: number | null; // TMDb 评分 0-10（可空）
};

const SEED_ITEMS: ItemSeed[] = [
  {
    item_id: "3016187", // = douban_id
    tmdb_id: 1399,
    media_type: "tv",
    title: "权力的游戏",
    original_title: "Game of Thrones",
    year: 2011,
    poster_path: "/u3bZgnGQ9T01sWNhyjkc3GiNYiz.jpg",
    overview:
      "九大家族为争夺铁王座在维斯特洛大陆展开权力斗争，绝境长城之外的异鬼威胁逐渐逼近。",
    director: "戴维·贝尼奥夫 / D·B·魏斯",
    writer: "乔治·R·R·马丁 / 戴维·贝尼奥夫",
    cast: "基特·哈灵顿 / 艾米莉亚·克拉克 / 彼特·丁拉基 / 琳娜·海蒂",
    genres: "剧情 / 奇幻 / 冒险",
    country: "US",
    language: "en",
    release_date: "2011-04-17",
    runtime: 57,
    aka: "冰与火之歌：权力的游戏,权力的游戏 第一季",
    imdb_id: "tt0944947",
    douban_id: "3016187",
    douban_rating: 9.5,
    tmdb_rating: 8.4,
  },
  {
    item_id: "11537954", // = douban_id
    tmdb_id: 244786,
    media_type: "tv",
    title: "瑞克和莫蒂",
    original_title: "Rick and Morty",
    year: 2013,
    poster_path: "/wpVUXzKfwU5JrwGXyPsUsBmvNzZ.jpg",
    overview: "天才疯子科学家瑞克带着懦弱的外孙莫蒂穿越多元宇宙展开荒诞冒险。",
    director: "贾斯汀·罗兰 / 丹·哈蒙",
    writer: "丹·哈蒙 / 贾斯汀·罗兰",
    cast: "贾斯汀·罗兰 / 克里斯·帕内尔 / 斯宾瑟·格拉默",
    genres: "喜剧 / 科幻 / 动画",
    country: "US",
    language: "en",
    release_date: "2013-12-02",
    runtime: 22,
    aka: "外星也难民",
    imdb_id: "tt2861424",
    douban_id: "11537954",
    douban_rating: 9.7,
    tmdb_rating: 8.7,
  },
  {
    item_id: "1292052", // = douban_id
    tmdb_id: 278,
    media_type: "movie",
    title: "肖申克的救赎",
    original_title: "The Shawshank Redemption",
    year: 1994,
    poster_path: "/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg",
    overview: "银行家安迪因冤案入狱，在高墙之内用希望与智慧完成自我救赎。",
    director: "弗兰克·德拉邦特",
    writer: "弗兰克·德拉邦特 / 斯蒂芬·金",
    cast: "蒂姆·罗宾斯 / 摩根·弗里曼 / 鲍勃·冈顿",
    genres: "剧情 / 犯罪",
    country: "US",
    language: "en",
    release_date: "1994-09-23",
    runtime: 142,
    aka: "月黑高飞,刺激1995,地狱诺言",
    imdb_id: "tt0111161",
    douban_id: "1292052",
    douban_rating: 9.7,
    tmdb_rating: 8.7,
  },
  {
    item_id: "35790301", // = douban_id
    tmdb_id: 1292069,
    media_type: "movie",
    title: "年会不能停！",
    original_title: "Annual Meeting Must Not Stop!",
    year: 2023,
    poster_path: "/pZnbksRjCgz8Ak1FueZw1W1sZ6L.jpg",
    overview: "基层钳工被误调入集团总部，引发一连串错位闹剧，讽刺职场众生相。",
    director: "董润年",
    writer: "董润年 / 应萝佳",
    cast: "大鹏 / 白客 / 庄达菲 / 王迅",
    genres: "喜剧 / 剧情",
    country: "CN",
    language: "zh",
    release_date: "2023-12-29",
    runtime: 117,
    aka: "年会",
    imdb_id: "tt28016335",
    douban_id: "35790301",
    douban_rating: 8.1,
    tmdb_rating: 7.4,
  },
  {
    item_id: "2121283", // = douban_id
    tmdb_id: 769,
    media_type: "movie",
    title: "机器人总动员",
    original_title: "WALL·E",
    year: 2008,
    poster_path: "/hbhFnRzzg6ZDmm8YAmxBnQpQIPh.jpg",
    overview: "地球清扫机器人瓦力偶遇探测机器人伊娃，携手开启星际旅程。",
    director: "安德鲁·斯坦顿",
    writer: "安德鲁·斯坦顿 / 皮特·多克特",
    cast: "本·贝尔特 / 艾丽莎·奈特 / 杰夫·格尔林",
    genres: "科幻 / 动画 / 爱情",
    country: "US",
    language: "en",
    release_date: "2008-06-27",
    runtime: 98,
    aka: "瓦力,星际总动员,机器人瓦力",
    imdb_id: "tt0910970",
    douban_id: "2121283",
    douban_rating: 9.4,
    tmdb_rating: 8.4,
  },
  {
    // 与上面的电视剧刻意使用不同 douban_id，验证 item_id = douban_id 时主键唯一不冲突
    item_id: "34826231", // = douban_id（剪辑版占位编号，无真实豆瓣条目）
    tmdb_id: 1399,
    media_type: "movie",
    title: "权力的游戏（电影版剪辑）",
    original_title: "Game of Thrones: The Movie Cut",
    year: 2019,
    poster_path: "/u3bZgnGQ9T01sWNhyjkc3GiNYiz.jpg",
    overview: "将剧集重新剪辑成电影长度的粉丝向版本。",
    director: "戴维·贝尼奥夫 / D·B·魏斯",
    writer: "乔治·R·R·马丁",
    cast: "基特·哈灵顿 / 艾米莉亚·克拉克",
    genres: "剧情 / 奇幻",
    country: "US",
    language: "en",
    release_date: "2019-05-19",
    runtime: 120,
    aka: "权游电影剪辑版",
    imdb_id: "tt11993436",
    douban_id: "34826231",
    douban_rating: null,
    tmdb_rating: 7.8,
  },
];

// --------------------------------------------------------------------------
// 批量生成补足到 TOTAL 部影片（真实样板 + 程序化虚构数据）
// --------------------------------------------------------------------------
const TOTAL = 100; // 影片总数，也等于 records 总数

const GENRES_POOL = [
  "剧情", "喜剧", "动作", "科幻", "爱情", "悬疑", "惊悚", "犯罪",
  "奇幻", "冒险", "动画", "家庭", "历史", "战争", "音乐", "恐怖",
];
const COUNTRY_POOL = ["US", "CN", "HK", "JP", "KR", "GB", "FR", "DE"];
const LANG_POOL = ["en", "zh", "ja", "ko", "fr", "de"];
const DIRECTORS = ["张艺谋", "克里斯托弗·诺兰", "宫崎骏", "是枝裕和", "大卫·芬奇", "李安", "斯皮尔伯格", "王家卫"];
const GEN_TITLE_PREFIX = ["暗夜", "星空", "时光", "迷城", "逆光", "深海", "风暴", "晨曦", "孤影", "破晓"];
const GEN_TITLE_SUFFIX = ["之约", "谜案", "传说", "往事", "边境", "纪元", "恋曲", "归途", "密码", "终章"];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

// 累加生成器：从 SEED 之后补足到 TOTAL 部。douban_id/item_id 用 9 位占位编号，
// 不与真实豆瓣号（多为 5-8 位）冲突，且 item_id 严格等于 douban_id。
const GENERATED: ItemSeed[] = [];
for (let i = SEED_ITEMS.length; i < TOTAL; i++) {
  const media_type: "movie" | "tv" = i % 3 === 0 ? "tv" : "movie";
  const douban_id = String(900000000 + i); // 占位编号，保证唯一且 != 真实号
  const year = 1990 + (i % 36); // 1990-2025
  const genres = [pick(GENRES_POOL, i), pick(GENRES_POOL, i + 5), pick(GENRES_POOL, i + 9)]
    .filter((v, idx, a) => a.indexOf(v) === idx)
    .join(" / ");
  GENERATED.push({
    item_id: douban_id,
    tmdb_id: 100000 + i, // 占位 tmdb 编号，避免与真实号混淆
    media_type,
    title: `${pick(GEN_TITLE_PREFIX, i)}${pick(GEN_TITLE_SUFFIX, i + 3)}`,
    original_title: `Generated Title ${i}`,
    year,
    poster_path: `/seed_${i}.jpg`,
    overview: "由种子脚本自动生成的占位剧情简介，用于测试报表与筛选功能。",
    director: pick(DIRECTORS, i),
    writer: pick(DIRECTORS, i + 2),
    cast: `${pick(DIRECTORS, i + 1)} / ${pick(DIRECTORS, i + 3)}`,
    genres,
    country: pick(COUNTRY_POOL, i),
    language: pick(LANG_POOL, i),
    release_date: `${year}-${String((i % 12) + 1).padStart(2, "0")}-15`,
    runtime: media_type === "tv" ? 45 : 90 + (i % 60),
    aka: "",
    imdb_id: `tt${9000000 + i}`,
    douban_id, // = item_id
    douban_rating: Number((6 + (i % 40) / 10).toFixed(1)), // 6.0 - 9.9
    tmdb_rating: Number((6 + (i % 35) / 10).toFixed(1)),
  });
}

const ITEMS: ItemSeed[] = [...SEED_ITEMS, ...GENERATED];

// --------------------------------------------------------------------------
// 我的观影记录（写入 imovie_records，item_id 为外键）
// --------------------------------------------------------------------------
type RecordSeed = {
  item_id: string; // 外键，必须等于 imovie_items 的某个 item_id 主键
  tmdb_id: number;
  media_type: "movie" | "tv";
  user_id: number;
  status: "plan" | "watched"; // 仅两种状态
  rating: number | null; // 仅 watched 填 1-10，plan 为 null
  tags: string; // 逗号分隔自定义标签
  watched_at: string | null; // 完成观看时间 'YYYY-MM-DD' 或 null
};

// 每条影片对应一条 user_id=1 的观影记录，总数 = ITEMS.length（即 100 条）。
// status 交替 plan/watched；watched 给 1-10 评分，plan 评分为 null。
const RECORDS: RecordSeed[] = ITEMS.map((it, i) => {
  const watched = i % 2 === 0;
  const status: "plan" | "watched" = watched ? "watched" : "plan";
  const year = it.year;
  return {
    item_id: it.item_id, // 外键 = 影片主键（= douban_id）
    tmdb_id: it.tmdb_id,
    media_type: it.media_type,
    user_id: 1,
    status,
    rating: watched ? ((i % 10) + 1) : null,
    tags: it.genres.split(" / ")[0] || "测试",
    watched_at: watched ? `${year}-${String((i % 12) + 1).padStart(2, "0")}-15` : null,
  };
});

// --------------------------------------------------------------------------
// 执行逻辑
// --------------------------------------------------------------------------
async function main() {
  const file = DB_URL.startsWith("file:") ? DB_URL.slice("file:".length) : DB_URL;
  const abs = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const url = `file:${abs}`;

  const db = createClient({ url });

  // 幂等：按 schema.sql 建表（含 IF NOT EXISTS），本地全新库可直接 seed；已存在则跳过
  const schema = fs.readFileSync(path.join(process.cwd(), "data", "schema.sql"), "utf-8");
  for (const st of schema.split(";").map((s) => s.trim()).filter(Boolean)) {
    await db.execute(st + ";");
  }

  // 1) 写入影片元数据；item_id 为本表 TEXT 主键，INSERT OR IGNORE 实现幂等（按主键去重）
  const itemSql = `
    INSERT OR IGNORE INTO imovie_items
      (item_id, media_type, title, original_title, year, poster_path,
       overview, director, writer, cast, genres, country, language,
       release_date, runtime, aka, imdb_id, douban_id, tmdb_id, douban_rating, tmdb_rating, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `;
  for (const it of ITEMS) {
    await db.execute({
      sql: itemSql,
      args: [
        it.item_id, // 主键（显式）
        it.media_type,
        it.title,
        it.original_title,
        it.year, // INTEGER，直接传数字
        it.poster_path,
        it.overview,
        it.director,
        it.writer,
        it.cast,
        it.genres,
        it.country,
        it.language,
        it.release_date,
        it.runtime,
        it.aka,
        it.imdb_id,
        it.douban_id,
        it.tmdb_id,
        it.douban_rating,
        it.tmdb_rating,
      ],
    });
  }

  // 2) 写入观影记录；item_id 为外键，引用 imovie_items 真实主键
  const recSql = `
    INSERT OR IGNORE INTO imovie_records
      (user_id, item_id, status, rating, tags, watched_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `;
  for (const r of RECORDS) {
    // 仅当对应影片主键已存在时才插入，保证外键（应用层语义）完整
    const exists = await db.execute({
      sql: "SELECT 1 FROM imovie_items WHERE item_id = ?",
      args: [r.item_id],
    });
    if (!exists.rows.length) {
      console.warn(`[seed] 跳过记录：找不到影片 ${r.item_id}`);
      continue;
    }
    await db.execute({
      sql: recSql,
      args: [r.user_id, r.item_id, r.status, r.rating, r.tags, r.watched_at],
    });
  }

  const itemCount = await db.execute("SELECT COUNT(*) AS c FROM imovie_items");
  const recCount = await db.execute("SELECT COUNT(*) AS c FROM imovie_records");
  console.log(
    `[seed] 完成：imovie_items = ${itemCount.rows[0].c}，imovie_records = ${recCount.rows[0].c}（已存在则忽略）`
  );
}

main().catch((err) => {
  console.error("[seed] 失败：", err);
  process.exit(1);
});
