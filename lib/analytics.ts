// lib/analytics.ts — 第三方流量统计配置（集中管理）。 / Third-party analytics config (centralized).
// 把对应 ID 填好后，components/Analytics 会自动以「底部脚本」方式注入；留空则不注入，避免无效请求。
// Once the IDs are filled in, components/Analytics injects them as a bottom script; blanks are skipped to avoid needless requests.
// 这些 ID 属站点凭证，若仓库公开请自行评估是否入库。
// These IDs are site credentials — assess before committing them to a public repo.

export const BAIDU_TONGJI_ID = "00dca50dc77694d0a813e9ac412c5132"; // 百度统计 token（hm.js? 之后的一段字符串） / Baidu Tongji token (string after hm.js?)
export const LA_51_ID = "LHw4cuGfSKYdftOm"; // 51.la「JS SDK Pro」的 id / 51.la "JS SDK Pro" id
export const LA_51_CK = "LHw4cuGfSKYdftOm"; // 51.la「JS SDK Pro」的 ck / 51.la "JS SDK Pro" ck
export const GA_MEASUREMENT_ID = "G-H0NM6DJ3B5"; // Google Analytics 4 衡量 ID（形如 G-XXXXXXXXXX） / Google Analytics 4 measurement ID (e.g. G-XXXXXXXXXX)
