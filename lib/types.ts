// 全局共享类型定义，保证前端组件与后端查询字段一致。

export type MediaType = "movie" | "tv";
export type Status = "plan" | "watched";

// 影片元数据（对应 imovie_items 表）
export interface Item {
  tmdb_id: number;
  media_type: MediaType;
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
  douban_rating?: number | null;
  tmdb_rating?: number | null;
}

// 一条观影记录 + 关联的影片元数据（看板/详情/搜索的通用返回结构）
export interface RecordRow {
  rec_id: number;
  status: Status;
  rating?: number | null;
  tags?: string | null;
  watched_at?: string | null;
  created_at?: string | null; // 记录创建（添加）时间，用于「想看」场景展示添加日期
  item: Item;
}

// 报表按年分组结构
// items 仅供未来年份下钻使用，报表页当前仅消费 count/avg，故设为可选。
export interface YearGroup {
  year: number;
  count: number;
  avg: number | null;
  items?: RecordRow[];
}

export interface ReportData {
  overview: {
    totalWatched: number;
    avgRating: number | null;
    thisYearWatched: number;
  };
  years: YearGroup[];
}

// 年份下钻：按月（YYYY-MM）分组观影记录
export interface MonthBucket {
  monthKey: string; // 中性标识，例如 "2026-01"（展示文案由前端按语言格式化）
  monthLabel: string; // 同 monthKey 占位（实际展示用 formatMonth 生成）
  count: number;
  items: RecordRow[];
}

export interface YearReportData {
  year: number;
  total: number;
  months: MonthBucket[];
}
