// 站点结构性参数统一抽取到此（导航、友情链接、类型筛选项等），
// 文案本身走 translations.ts，这里只放「结构 + key 映射」，便于一处维护。

export const SITE_NAME = "iMOVIE";

// 右下角「反馈问题」按钮跳转的 GitHub 链接（默认指向 Issues 页，按需改成你的实际仓库地址）。
export const FEEDBACK_GITHUB_URL = "https://github.com/layicr/imovie/issues";

export const NAV_LINKS: { href: string; key: string }[] = [
  { href: "/", key: "nav.home" },
  { href: "/search", key: "nav.search" },
  { href: "/report", key: "nav.report" },
];

export const FOOTER_LINKS: { href: string; key: string }[] = [
  { href: "https://github.com/layicr/imovie", key: "footer.github" },
  { href: "https://www.douban.com/people/48161908", key: "footer.douban" },
  { href: "http://b.lyc.la/", key: "footer.iblog" },
];

export interface GenreOption {
  // value：后端按此值做 genres LIKE 匹配（库里存的是中文/原值，故中文为规范值）
  value: string;
  zh: string;
  en: string;
}

// 类型筛选 chips：显示随语言切换，但筛选值保持与数据库一致（中文/原值）。
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
  // value：后端按此值做 country LIKE 匹配（库里存的是中文/原值，故中文为规范值）
  value: string;
  zh: string;
  en: string;
}

// 制片国家/地区筛选 chips：显示随语言切换，但筛选值保持与数据库一致（中文/原值）。
export const COUNTRY_OPTIONS: CountryOption[] = [
  // 亚洲
  { value: "中国大陆", zh: "中国大陆", en: "China" },
  { value: "香港", zh: "香港", en: "Hong Kong" },
  { value: "澳门", zh: "澳门", en: "Macau" },
  { value: "台湾", zh: "中国台湾", en: "Taiwan" },
  { value: "日本", zh: "日本", en: "Japan" },
  { value: "韩国", zh: "韩国", en: "South Korea" },
  { value: "朝鲜", zh: "朝鲜", en: "North Korea" },
  { value: "印度", zh: "印度", en: "India" },
  { value: "泰国", zh: "泰国", en: "Thailand" },
  { value: "越南", zh: "越南", en: "Vietnam" },
  { value: "新加坡", zh: "新加坡", en: "Singapore" },
  { value: "马来西亚", zh: "马来西亚", en: "Malaysia" },
  { value: "印度尼西亚", zh: "印度尼西亚", en: "Indonesia" },
  { value: "菲律宾", zh: "菲律宾", en: "Philippines" },
  { value: "土耳其", zh: "土耳其", en: "Turkey" },
  { value: "伊朗", zh: "伊朗", en: "Iran" },
  { value: "以色列", zh: "以色列", en: "Israel" },
  { value: "沙特阿拉伯", zh: "沙特阿拉伯", en: "Saudi Arabia" },
  { value: "巴基斯坦", zh: "巴基斯坦", en: "Pakistan" },
  { value: "哈萨克斯坦", zh: "哈萨克斯坦", en: "Kazakhstan" },
  // 欧洲
  { value: "英国", zh: "英国", en: "UK" },
  { value: "法国", zh: "法国", en: "France" },
  { value: "德国", zh: "德国", en: "Germany" },
  { value: "意大利", zh: "意大利", en: "Italy" },
  { value: "西班牙", zh: "西班牙", en: "Spain" },
  { value: "葡萄牙", zh: "葡萄牙", en: "Portugal" },
  { value: "荷兰", zh: "荷兰", en: "Netherlands" },
  { value: "比利时", zh: "比利时", en: "Belgium" },
  { value: "瑞士", zh: "瑞士", en: "Switzerland" },
  { value: "奥地利", zh: "奥地利", en: "Austria" },
  { value: "爱尔兰", zh: "爱尔兰", en: "Ireland" },
  { value: "俄罗斯", zh: "俄罗斯", en: "Russia" },
  { value: "瑞典", zh: "瑞典", en: "Sweden" },
  { value: "挪威", zh: "挪威", en: "Norway" },
  { value: "丹麦", zh: "丹麦", en: "Denmark" },
  { value: "芬兰", zh: "芬兰", en: "Finland" },
  { value: "冰岛", zh: "冰岛", en: "Iceland" },
  { value: "波兰", zh: "波兰", en: "Poland" },
  { value: "捷克", zh: "捷克", en: "Czech Republic" },
  { value: "希腊", zh: "希腊", en: "Greece" },
  { value: "匈牙利", zh: "匈牙利", en: "Hungary" },
  { value: "罗马尼亚", zh: "罗马尼亚", en: "Romania" },
  { value: "乌克兰", zh: "乌克兰", en: "Ukraine" },
  // 美洲
  { value: "美国", zh: "美国", en: "USA" },
  { value: "加拿大", zh: "加拿大", en: "Canada" },
  { value: "墨西哥", zh: "墨西哥", en: "Mexico" },
  { value: "巴西", zh: "巴西", en: "Brazil" },
  { value: "阿根廷", zh: "阿根廷", en: "Argentina" },
  { value: "智利", zh: "智利", en: "Chile" },
  { value: "哥伦比亚", zh: "哥伦比亚", en: "Colombia" },
  { value: "古巴", zh: "古巴", en: "Cuba" },
  { value: "秘鲁", zh: "秘鲁", en: "Peru" },
  // 大洋洲
  { value: "澳大利亚", zh: "澳大利亚", en: "Australia" },
  { value: "新西兰", zh: "新西兰", en: "New Zealand" },
  // 非洲
  { value: "南非", zh: "南非", en: "South Africa" },
  { value: "埃及", zh: "埃及", en: "Egypt" },
  { value: "尼日利亚", zh: "尼日利亚", en: "Nigeria" },
  { value: "摩洛哥", zh: "摩洛哥", en: "Morocco" },
  { value: "肯尼亚", zh: "肯尼亚", en: "Kenya" },
];

// 分页：每页条数可选项（集中在 config 维护，前后端共用同一上限）。
// PAGE_SIZE_DEFAULT 为默认每页条数；数组最后一个值即允许的最大条数。
export const PAGE_SIZE_OPTIONS: number[] = [ 30, 60, 90, 120];
export const PAGE_SIZE_DEFAULT = 30;
export const PAGE_SIZE_MAX = PAGE_SIZE_OPTIONS[PAGE_SIZE_OPTIONS.length - 1];

// 首页看板两行板块的展示数量（想看 / 已看），集中配置便于调整。
export const HOME_PLAN_LIMIT = 10;
export const HOME_WATCHED_LIMIT = 30;
