import { defineConfig, devices } from "@playwright/test";

// iMOVIE UI 端到端测试配置
// - 自动拉起 `next dev`（依赖 data/local.db，本地无需密码）
// - 两个项目：desktop（Web 端 1280×800）与 mobile（移动端 390×844 触摸）
// - 仅测试已构建好的界面行为，不改动应用源码
export default defineConfig({
  testDir: "./test/e2e",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [["list"], ["json", { outputFile: "test/.playwright-report.json" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "web-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      // 移动端：使用 Chromium 引擎 + iPhone 视口（避免额外下载 WebKit）。
      name: "mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
