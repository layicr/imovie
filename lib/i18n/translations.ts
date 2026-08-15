// 全站中英双语字典的索引入口。
// 具体文案已拆分为 zh.ts（中文）与 en.ts（英文）两个文件，便于各自维护。
// 组件通过 t(key[, vars]) 渲染，支持 {0}{1} 占位插值（见 LanguageProvider）。
// 影片元数据（片名/简介等）来自数据库，不在此翻译。

import { zh } from "./zh";
import { en } from "./en";

export type Lang = "zh" | "en";

export const LANGS: { code: Lang; label: string }[] = [
  { code: "zh", label: "中文" },
  { code: "en", label: "EN" },
];

// 合并两个语言文件为一个字典；新增语种只需在此加一项并新增对应文件。
export const translations: Record<Lang, Record<string, string>> = { zh, en };
