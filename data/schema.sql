-- ============================================================
-- iMOVIE 数据库结构（Turso / libSQL，兼容 SQLite 语法）
-- ============================================================
-- 设计要点：
--   1. 影片「元数据」与用户「观影记录」两张表分离：
--      - imovie_items   存影片的客观信息（来自 TMDb，按 tmdb_id 去重缓存，多人共享一份）；
--      - imovie_records 存「我」对影片的主观状态（想看/已看、评分、标签），与具体用户绑定。
--   2. 豆瓣导入时不重复拉取 TMDb 已有元数据，仅在 imovie_records 补入豆瓣评分与状态。
--   3. 所有时间字段用 TEXT 存「北京时间」（datetime('now','+8 hours')，即 UTC+8 墙钟时间），
--      与站点用户所在时区一致，便于展示与按年分组。格式统一为 'YYYY-MM-DD HH:MM:SS'。
--   4. 海报只存 TMDb 的相对路径（不含域名），展示时拼接 image.tmdb.org 前缀。
-- ============================================================


-- ------------------------------------------------------------
-- 表一：imovie_items —— 影片元数据表
-- 来源：TMDb 搜索/详情接口（首次访问某影片时写入并缓存，后续复用）。
-- 主键：tmdb_id（TMDb 影片唯一编号），天然去重，同一影片在全站只有一行。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS imovie_items (
  tmdb_id        INTEGER PRIMARY KEY,              -- TMDb 影片/剧集唯一 ID，作为本表主键
  media_type     TEXT NOT NULL,                   -- 媒体类型：'movie' 电影 | 'tv' 电视剧
  title          TEXT NOT NULL,                   -- 中文/本地化片名（展示用主标题）
  original_title TEXT,                            -- 原名（如英文原名），无则不填
  year           INTEGER,                         -- 上映/首播年份（用于报表按年分组与筛选）
  poster_path    TEXT,                            -- TMDb 海报相对路径（如 /abc.jpg），不含域名；无图则空
  overview       TEXT,                            -- 剧情简介（TMDb 提供，可能为空）
  director       TEXT,                            -- 导演（多名用 / 分隔；电视剧可能为空）
  writer         TEXT,                            -- 编剧（多名用 / 分隔）
  cast           TEXT,                            -- 主演（多名用 / 分隔，详情页展示「更多…」截断）
  genres         TEXT,                            -- 类型标签，逗号分隔（如 喜剧,动画,奇幻）
  country        TEXT,                            -- 制片国家/地区
  language       TEXT,                            -- 语言（如 汉语普通话）
  release_date   TEXT,                            -- 上映日期（ISO，如 2026-07-18，可带地区后缀）
  runtime        INTEGER,                         -- 片长（分钟）；电视剧多为单集时长或空
  aka            TEXT,                            -- 又名（其他译名/别名，逗号分隔）
  imdb_id        TEXT,                            -- IMDb 编号（如 tt1234567），外链用
  douban_id      TEXT,                            -- 豆瓣编号（如 1292052），外链用（导入时带入，页面不展示）
  douban_rating  REAL,                            -- 豆瓣评分（仅豆瓣导入时带入，单独展示，不混入站内评分）
  tmdb_rating    REAL,                            -- TMDb 评分（站内展示的专业评分，0–10）
  updated_at     TEXT DEFAULT (datetime('now', '+8 hours'))   -- 元数据最后更新时间（北京时间），便于识别过期缓存
);


-- ------------------------------------------------------------
-- 表二：imovie_records —— 用户观影记录表（站点核心数据）
-- 含义：用户对某部影片的「私人状态」。同一用户同一影片只保留一条。
-- 两状态严格对应需求：plan=想看（待看）、watched=已看（已看完可打分）。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS imovie_records (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,  -- 记录自增主键（站内内部 ID）
  user_id     INTEGER DEFAULT 1,                  -- 用户 ID（当前为单人站，默认 1；多用户时区分归属）
  tmdb_id     INTEGER NOT NULL,                   -- 关联 imovie_items.tmdb_id，外键语义（靠应用层保证存在）
  status      TEXT NOT NULL,                      -- 状态：'plan' 想看 | 'watched' 已看（无「在看」）
  rating      INTEGER,                            -- 评分（仅 watched 时填，1–10；plan 时为 NULL）
  tags        TEXT,                               -- 自定义标签，逗号分隔（用户自由打标，用于检索）
  watched_at  TEXT,                               -- 实际观看完成时间（watched 状态记录，可选）
  created_at  TEXT DEFAULT (datetime('now', '+8 hours')),     -- 记录创建时间（加入清单的时间，北京时间）
  UNIQUE(user_id, tmdb_id)                        -- 唯一约束：同一用户同一影片不可重复添加
);


-- ------------------------------------------------------------
-- 索引：加速高频筛选与统计
-- ------------------------------------------------------------
-- 按状态筛选（看板「想看 / 已看」两行、报表分组都依赖它）
CREATE INDEX IF NOT EXISTS idx_imovie_records_status ON imovie_records(status);
-- 按用户隔离数据（多用户场景下快速取出某用户全部记录）
CREATE INDEX IF NOT EXISTS idx_imovie_records_user   ON imovie_records(user_id);
-- 按年份筛选与报表分组（imovie_items.year 常用于「年度报告」海报墙）
CREATE INDEX IF NOT EXISTS idx_imovie_items_year     ON imovie_items(year);
