import type { Config } from "tailwindcss";

// 主题色与字体严格对应「Netflix 流媒体风」视觉规范
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#141414", // 近黑底
        panel: "#1c1c1f", // 面板
        line: "#2a2a2e", // 分隔线
        subtle: "#9a9a9e", // 次要文字
        brand: "#e50914", // 强调红
      },
      fontFamily: {
        // 大标题用 Bebas Neue（窄体大写）；正文用 Inter / Noto Sans SC
        display: ["var(--font-bebas)", "Bebas Neue", "Noto Sans SC", "sans-serif"],
        body: ["var(--font-inter)", "Inter", "Noto Sans SC", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
