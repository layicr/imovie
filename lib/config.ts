// lib/config.ts — 站点结构性参数统一配置。 / Site structural config (centralized).
// 文案本身走 translations.ts，这里只放「结构 + key 映射」，便于一处维护。
// Copy lives in translations.ts; here we keep only structure + key mapping for one-place maintenance.

export const SITE_NAME = "iMOVIE";

// 右下角「反馈问题」按钮跳转的 GitHub 链接（默认指向 Issues 页，按需改成你的实际仓库地址）。
// GitHub link for the bottom-right "feedback" button (points to Issues by default; change to your repo).
export const FEEDBACK_GITHUB_URL = "https://github.com/layicr/imovie/issues";

// 顶部导航链接：href 为路由，key 对应 translations 中的文案键。
// Top nav links: href is the route, key maps to a translation entry.
export const NAV_LINKS: { href: string; key: string }[] = [
  { href: "/", key: "nav.home" },
  { href: "/search", key: "nav.search" },
  { href: "/report", key: "nav.report" },
];

// 页脚友情链接：href 为外链，key 对应 translations 中的文案键。
// Footer friend links: href is external, key maps to a translation entry.
export const FOOTER_LINKS: { href: string; key: string }[] = [
  { href: "https://github.com/layicr/imovie", key: "footer.github" },
  { href: "https://www.douban.com/people/48161908", key: "footer.douban" },
  { href: "http://b.lyc.la/", key: "footer.iblog" },
];

export interface GenreOption {
  // value：后端按此值做 genres LIKE 匹配（库里存的是中文/原值，故中文为规范值）
  // value: the value used for a genres LIKE match on the backend (DB stores Chinese/original, so Chinese is canonical).
  value: string;
  zh: string;
  en: string;
}

// 类型筛选 chips：显示随语言切换，但筛选值保持与数据库一致（中文/原值）。
// Genre filter chips: labels switch by language, but filter values stay aligned with the DB (Chinese/original).
export const GENRE_OPTIONS: GenreOption[] = [
  // 剧情 / 情感
  { value: "剧情", zh: "剧情", en: "Drama" },
  { value: "爱情", zh: "爱情", en: "Romance" },
  { value: "喜剧", zh: "喜剧", en: "Comedy" },
  { value: "家庭", zh: "家庭", en: "Family" },
  { value: "传记", zh: "传记", en: "Biography" },
  { value: "同性", zh: "同性", en: "LGBT" },
  // 动作 / 冒险
  { value: "动作", zh: "动作", en: "Action" },
  { value: "冒险", zh: "冒险", en: "Adventure" },
  { value: "武侠", zh: "武侠", en: "Wuxia" },
  { value: "西部", zh: "西部", en: "Western" },
  { value: "战争", zh: "战争", en: "War" },
  { value: "犯罪", zh: "犯罪", en: "Crime" },
  { value: "惊悚", zh: "惊悚", en: "Thriller" },
  { value: "悬疑", zh: "悬疑", en: "Mystery" },
  { value: "恐怖", zh: "恐怖", en: "Horror" },
  // 科幻 / 奇幻
  { value: "科幻", zh: "科幻", en: "Sci-Fi" },
  { value: "奇幻", zh: "奇幻", en: "Fantasy" },
  { value: "灾难", zh: "灾难", en: "Disaster" },
  // 历史 / 文化
  { value: "历史", zh: "历史", en: "History" },
  { value: "古装", zh: "古装", en: "Costume" },
  { value: "歌舞", zh: "歌舞", en: "Musical" },
  { value: "音乐", zh: "音乐", en: "Music" },
  { value: "动画", zh: "动画", en: "Animation" },
  { value: "运动", zh: "运动", en: "Sport" },
  // 纪实 / 其他
  { value: "纪录片", zh: "纪录片", en: "Documentary" },
  { value: "短片", zh: "短片", en: "Short" },
  { value: "儿童", zh: "儿童", en: "Children" },
  { value: "青春", zh: "青春", en: "Youth" },
  { value: "真人秀", zh: "真人秀", en: "Reality" },
  { value: "脱口秀", zh: "脱口秀", en: "Talk Show" },
  { value: "戏曲", zh: "戏曲", en: "Opera" },
  { value: "IMAX", zh: "IMAX", en: "IMAX" },
];

export interface CountryOption {
  // value：后端按此值做 country LIKE 匹配（库里存的是 2 位 ISO 3166-1 alpha-2 代码，如 CN/US，故代码为规范值）
  // value: the value used for a country LIKE match (DB stores 2-letter ISO 3166-1 alpha-2, e.g. CN/US, so the code is canonical).
  value: string;
  zh: string;
  en: string;
}

// 制片国家/地区筛选 chips：显示随语言切换，但筛选值保持与数据库一致（中文/原值）。
// Country/region filter chips: labels switch by language, but filter values stay aligned with the DB (Chinese/original).
export const COUNTRY_OPTIONS: CountryOption[] = [
  // 亚洲
  { value: "CN", zh: "中国大陆", en: "China" },
  { value: "HK", zh: "香港", en: "Hong Kong" },
  { value: "MO", zh: "澳门", en: "Macau" },
  { value: "TW", zh: "中国台湾", en: "Taiwan" },
  { value: "JP", zh: "日本", en: "Japan" },
  { value: "KR", zh: "韩国", en: "South Korea" },
  { value: "KP", zh: "朝鲜", en: "North Korea" },
  { value: "IN", zh: "印度", en: "India" },
  { value: "TH", zh: "泰国", en: "Thailand" },
  { value: "VN", zh: "越南", en: "Vietnam" },
  { value: "SG", zh: "新加坡", en: "Singapore" },
  { value: "MY", zh: "马来西亚", en: "Malaysia" },
  { value: "ID", zh: "印度尼西亚", en: "Indonesia" },
  { value: "PH", zh: "菲律宾", en: "Philippines" },
  { value: "TR", zh: "土耳其", en: "Turkey" },
  { value: "IR", zh: "伊朗", en: "Iran" },
  { value: "IL", zh: "以色列", en: "Israel" },
  { value: "SA", zh: "沙特阿拉伯", en: "Saudi Arabia" },
  { value: "PK", zh: "巴基斯坦", en: "Pakistan" },
  { value: "KZ", zh: "哈萨克斯坦", en: "Kazakhstan" },
  // 欧洲
  { value: "GB", zh: "英国", en: "UK" },
  { value: "FR", zh: "法国", en: "France" },
  { value: "DE", zh: "德国", en: "Germany" },
  { value: "IT", zh: "意大利", en: "Italy" },
  { value: "ES", zh: "西班牙", en: "Spain" },
  { value: "PT", zh: "葡萄牙", en: "Portugal" },
  { value: "NL", zh: "荷兰", en: "Netherlands" },
  { value: "BE", zh: "比利时", en: "Belgium" },
  { value: "CH", zh: "瑞士", en: "Switzerland" },
  { value: "AT", zh: "奥地利", en: "Austria" },
  { value: "IE", zh: "爱尔兰", en: "Ireland" },
  { value: "RU", zh: "俄罗斯", en: "Russia" },
  { value: "SE", zh: "瑞典", en: "Sweden" },
  { value: "NO", zh: "挪威", en: "Norway" },
  { value: "DK", zh: "丹麦", en: "Denmark" },
  { value: "FI", zh: "芬兰", en: "Finland" },
  { value: "IS", zh: "冰岛", en: "Iceland" },
  { value: "PL", zh: "波兰", en: "Poland" },
  { value: "CZ", zh: "捷克", en: "Czech Republic" },
  { value: "GR", zh: "希腊", en: "Greece" },
  { value: "HU", zh: "匈牙利", en: "Hungary" },
  { value: "RO", zh: "罗马尼亚", en: "Romania" },
  { value: "UA", zh: "乌克兰", en: "Ukraine" },
  // 美洲
  { value: "US", zh: "美国", en: "USA" },
  { value: "CA", zh: "加拿大", en: "Canada" },
  { value: "MX", zh: "墨西哥", en: "Mexico" },
  { value: "BR", zh: "巴西", en: "Brazil" },
  { value: "AR", zh: "阿根廷", en: "Argentina" },
  { value: "CL", zh: "智利", en: "Chile" },
  { value: "CO", zh: "哥伦比亚", en: "Colombia" },
  { value: "CU", zh: "古巴", en: "Cuba" },
  { value: "PE", zh: "秘鲁", en: "Peru" },
  // 大洋洲
  { value: "AU", zh: "澳大利亚", en: "Australia" },
  { value: "NZ", zh: "新西兰", en: "New Zealand" },
  // 非洲
  { value: "ZA", zh: "南非", en: "South Africa" },
  { value: "EG", zh: "埃及", en: "Egypt" },
  { value: "NG", zh: "尼日利亚", en: "Nigeria" },
  { value: "MA", zh: "摩洛哥", en: "Morocco" },
  { value: "KE", zh: "肯尼亚", en: "Kenya" },
  { value: "LB", zh: "黎巴嫩", en: "Lebanon" },
  { value: "MT", zh: "马耳他", en: "Malta" },
];

export interface LanguageOption {
  // value：后端按此值做 language LIKE 匹配（库里存 ISO 639-1 两位小写代码，如 zh/en/ja）。
  // value: the value used for a language LIKE match (DB stores ISO 639-1 two-letter lowercase, e.g. zh/en/ja).
  value: string;
  zh: string;
  en: string;
}

// 语言筛选 chips：库里以 ISO 639-1 两位小写代码存储，显示随语言切换。
// Language filter chips: DB stores ISO 639-1 two-letter lowercase; labels switch by language.
export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: "zh", zh: "汉语", en: "Chinese" },
  { value: "en", zh: "英语", en: "English" },
  { value: "ja", zh: "日语", en: "Japanese" },
  { value: "ko", zh: "韩语", en: "Korean" },
  { value: "fr", zh: "法语", en: "French" },
  { value: "de", zh: "德语", en: "German" },
  { value: "es", zh: "西班牙语", en: "Spanish" },
  { value: "it", zh: "意大利语", en: "Italian" },
  { value: "ru", zh: "俄语", en: "Russian" },
  { value: "pt", zh: "葡萄牙语", en: "Portuguese" },
  { value: "th", zh: "泰语", en: "Thai" },
  { value: "hi", zh: "印地语", en: "Hindi" },
  { value: "ar", zh: "阿拉伯语", en: "Arabic" },
  { value: "tr", zh: "土耳其语", en: "Turkish" },
  { value: "vi", zh: "越南语", en: "Vietnamese" },
  { value: "id", zh: "印尼语", en: "Indonesian" },
  { value: "ms", zh: "马来语", en: "Malay" },
  { value: "pl", zh: "波兰语", en: "Polish" },
  { value: "nl", zh: "荷兰语", en: "Dutch" },
  { value: "sv", zh: "瑞典语", en: "Swedish" },
  { value: "da", zh: "丹麦语", en: "Danish" },
  { value: "fi", zh: "芬兰语", en: "Finnish" },
  { value: "no", zh: "挪威语", en: "Norwegian" },
  { value: "cs", zh: "捷克语", en: "Czech" },
  { value: "el", zh: "希腊语", en: "Greek" },
  { value: "he", zh: "希伯来语", en: "Hebrew" },
  { value: "hu", zh: "匈牙利语", en: "Hungarian" },
  { value: "ro", zh: "罗马尼亚语", en: "Romanian" },
  { value: "uk", zh: "乌克兰语", en: "Ukrainian" },
  { value: "fa", zh: "波斯语", en: "Persian" },
];

// 分页：每页条数可选项（集中在 config 维护，前后端共用同一上限）。
// Pagination: per-page options (centralized; frontend and backend share the same cap).
// PAGE_SIZE_DEFAULT 为默认每页条数；数组最后一个值即允许的最大条数。
// PAGE_SIZE_DEFAULT is the default per-page size; the last array item is the allowed maximum.
export const PAGE_SIZE_OPTIONS: number[] = [30, 60, 90, 120];
export const PAGE_SIZE_DEFAULT = 60;
export const PAGE_SIZE_MAX = PAGE_SIZE_OPTIONS[PAGE_SIZE_OPTIONS.length - 1];

// 首页看板两行板块的展示数量（想看 / 已看），集中配置便于调整。
// Home dashboard row sizes (plan / watched), centralized for easy tuning.
export const HOME_PLAN_LIMIT = 10;
export const HOME_WATCHED_LIMIT = 30;
