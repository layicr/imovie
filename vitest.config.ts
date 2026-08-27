// vitest.config.ts — 单元 & 功能测试配置
// 测试套件(test/)离线运行，覆盖纯函数(zod 校验/海报 URL/配置)、内存库查询与 API 路由。
// 使用 node 环境（无浏览器 API），并通过 @ 别名复用 tsconfig 的 @/ 路径映射。
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    globals: false,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
});
