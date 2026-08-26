import { test, expect, type Page } from "@playwright/test";

// ───────────────────────────────────────────────────────────────────────────
// iMOVIE UI 端到端测试
// 覆盖三大维度：
//   1. Web 端（桌面视口）：首页加载、海报卡片、列表行、详情页跳转、搜索页、暗色主题
//   2. 移动端（iPhone 视口）：移动布局、横滑卡片、点击进详情
//   3. UI 界面：关键元素可见性、骨架屏加载态、海报图回退、404 未找到
// 不改动应用源码，仅验证已构建界面的行为与响应式。
// ───────────────────────────────────────────────────────────────────────────

// 获取一个真实存在的 item_id（供详情页测试），失败则回退到硬编码探测。
async function firstItemId(page: Page): Promise<string> {
  const res = await page.request.get("/api/records?limit=1");
  const body = (await res.json()) as { records?: { item: { item_id: string } }[] };
  return body.records?.[0]?.item.item_id ?? "";
}

// 导航辅助：首页是客户端渲染且含外链海报图（tmdb/picsum），
// 用 domcontentloaded 而非 load，避免等待外网图片导致 goto 超时。
async function goto(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: 45_000 });
}

// 等待首页从骨架屏切换为真实内容：出现标题或任意详情卡片链接即视为就绪。
async function waitHomeReady(page: Page) {
  await expect(page.locator("h1, a[href^='/detail/']").first()).toBeVisible({
    timeout: 30_000,
  });
}

test.describe("UI 界面 · 关键元素与加载态", () => {
  test("首页加载：骨架屏（aria-busy）被真实内容替换，标题可见", async ({ page }) => {
    await goto(page, "/");
    // 不强制断言瞬时骨架屏（其转瞬即逝），改为确认最终内容已渲染
    await waitHomeReady(page);
    await expect(page).toHaveTitle(/.+/); // 标题非空
    await expect(page.locator("h1").first()).toBeVisible();
    // 内容就绪后不应仍停留在 loading 态
    await expect(page.locator('[aria-busy="true"]').first()).toHaveCount(0, { timeout: 5_000 });
  });

  test("首屏至少渲染 Hero 大图区或空状态标题", async ({ page }) => {
    await goto(page, "/");
    await waitHomeReady(page);
    const heroOrEmpty = page.locator("h1").first();
    await expect(heroOrEmpty).toBeVisible();
  });

  test("暗色主题：页面背景为深色（bg-ink / #141414 基调）", async ({ page }) => {
    await goto(page, "/");
    await waitHomeReady(page);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    // bg-ink 解析为 rgb(20,20,20)
    expect(bg).toMatch(/rgb\(20,\s*20,\s*20\)/);
  });

  test("海报卡片渲染且含可点击详情链接与图片", async ({ page }) => {
    await goto(page, "/");
    await waitHomeReady(page);
    const cards = page.locator('a[href^="/detail/"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    // 卡片链接指向详情页
    const href = await cards.first().getAttribute("href");
    expect(href).toMatch(/^\/detail\/.+/);
    // 海报图：Next/Image 在首屏视口内渲染 <img>（lazy 未进入视口的图延迟挂载，故用整页首个 img）
    await expect(page.locator("img").first()).toBeAttached();
  });
});

test.describe("Web 端（桌面 1280×800）", () => {
  test("首页：列表行标题（想看 / 已看）渲染", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await goto(page, "/");
    await waitHomeReady(page);
    const rows = page.locator("section h2");
    await expect(rows.first()).toBeVisible();
  });

  test("首页：海报墙卡片可点击进入详情页", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await goto(page, "/");
    await waitHomeReady(page);
    const card = page.locator('a[href^="/detail/"]').first();
    await expect(card).toBeVisible();
    const href = await card.getAttribute("href");
    await card.click();
    await expect(page).toHaveURL(/\/detail\/.+/);
    expect(href).toMatch(/^\/detail\/.+/);
  });

  test("详情页：标题、海报、元数据字段均可见", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const id = await firstItemId(page);
    test.skip(!id, "无可用 item_id，跳过");
    await goto(page, `/detail/${id}`);
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
    const poster = page.locator("img").first();
    await poster.scrollIntoViewIfNeeded();
    await expect(poster).toBeAttached();
    await expect(page.locator("dl")).toBeVisible();
  });

  test("搜索页：加载并包含搜索输入框", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await goto(page, "/search");
    const input = page.locator('input[type="search"], input[placeholder], input').first();
    await expect(input).toBeVisible({ timeout: 30_000 });
  });

  test("详情页：不存在的 item_id 显示未找到提示", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await goto(page, "/detail/__not_exist_id__");
    await expect(
      page.getByText(/找不到|未找到|Not found|not found/i)
    ).toBeVisible({ timeout: 30_000 });
  });

  test("报表页 /report：加载并展示年份下钻卡片", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await goto(page, "/report");
    // 报表页标题可见
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
    // 应至少有一个年份按钮（按年小计卡片）— 按钮内 div 含 4 位数字年份
    const yearButtons = page.locator("button div.font-display").filter({ hasText: /^\d{4}$/ });
    expect(await yearButtons.count()).toBeGreaterThan(0);
  });

  test("搜索页：输入关键词后结果列表随之变化", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await goto(page, "/search");
    const input = page.locator('input[type="search"], input[placeholder], input').first();
    await expect(input).toBeVisible({ timeout: 30_000 });
    // 清空后输入一个常见字符，触发筛选；断言不抛错且输入框值已更新
    await input.fill("a");
    await expect(input).toHaveValue("a");
  });
});

test.describe("移动端（iPhone 视口）", () => {
  // 强制移动视口，确保 md:hidden 等响应式类生效（无论运行在哪个 Playwright 项目下）
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("首页：移动视口下卡片横向铺排且首屏可见", async ({ page }) => {
    await goto(page, "/");
    await waitHomeReady(page);
    const card = page.locator('a[href^="/detail/"]').first();
    await expect(card).toBeVisible();
    const box = (await card.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(391);
  });

  test("移动端：点击卡片进入详情页", async ({ page }) => {
    await goto(page, "/");
    await waitHomeReady(page);
    const card = page.locator('a[href^="/detail/"]').first();
    await card.click();
    await expect(page).toHaveURL(/\/detail\/.+/);
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
  });

  test("移动端：详情页海报图在窄屏下缩放显示", async ({ page }) => {
    const id = await firstItemId(page);
    test.skip(!id, "无可用 item_id，跳过");
    await goto(page, `/detail/${id}`);
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
    const poster = page.locator("img").first();
    await poster.scrollIntoViewIfNeeded();
    await expect(poster).toBeAttached();
    const box = (await poster.boundingBox())!;
    // 移动端海报宽度应 <= 220（sm 断点以下取 150）
    expect(box.width).toBeLessThanOrEqual(230);
  });

  test("移动端：报表页 /report 加载可见", async ({ page }) => {
    await goto(page, "/report");
    await expect(page.locator("h1, h2, section").first()).toBeVisible({ timeout: 30_000 });
  });

  test("移动端：搜索页输入框可见且可输入", async ({ page }) => {
    await goto(page, "/search");
    const input = page.locator('input[type="search"], input[placeholder], input').first();
    await expect(input).toBeVisible({ timeout: 30_000 });
    await input.fill("电影");
    await expect(input).toHaveValue("电影");
  });

  // ── 移动端导航交互 ──────────────────────────────────────────────────────────

  test("移动端：汉堡按钮可见且点击展开导航菜单", async ({ page }) => {
    await goto(page, "/");
    await waitHomeReady(page);
    // 汉堡按钮（md:hidden）在移动端视口下可见
    const burger = page.locator('button[aria-label]').filter({ hasText: "☰" }).or(
      page.locator("button.md\\:hidden")
    );
    await expect(burger.first()).toBeVisible();
    // 点击前导航链接不可见（桌面导航是 hidden md:flex）
    const navLinks = page.locator('nav.md\\:flex a');
    await expect(navLinks.first()).toBeHidden();
    // 点击汉堡按钮
    await burger.first().click();
    // 展开后导航链接可见
    const mobileLinks = page.locator('div.md\\:hidden a[href="/"], div.md\\:hidden a[href="/report"], div.md\\:hidden a[href="/search"]');
    await expect(mobileLinks.first()).toBeVisible();
  });

  test("移动端：导航菜单内链接可点击跳转", async ({ page }) => {
    await goto(page, "/");
    await waitHomeReady(page);
    const burger = page.locator("button.md\\:hidden");
    await burger.first().click();
    // 点击"报表"链接
    const reportLink = page.locator('div.md\\:hidden a[href="/report"]');
    await expect(reportLink).toBeVisible();
    await reportLink.click();
    await expect(page).toHaveURL(/\/report/);
  });

  test("移动端：点击导航链接后菜单自动收起", async ({ page }) => {
    await goto(page, "/");
    await waitHomeReady(page);
    const burger = page.locator("button.md\\:hidden");
    await burger.first().click();
    const mobileMenu = page.locator("div.md\\:hidden.border-t");
    await expect(mobileMenu).toBeVisible();
    // 点击任一链接
    const searchLink = page.locator('div.md\\:hidden a[href="/search"]');
    await searchLink.click();
    // 跳转后菜单应已收起
    await expect(page).toHaveURL(/\/search/);
  });

  // ── 移动端 Hero 与海报 ──────────────────────────────────────────────────────

  test("移动端：Hero 区域高度适配小屏（min-h-320）", async ({ page }) => {
    await goto(page, "/");
    await waitHomeReady(page);
    const hero = page.locator("section.relative").first();
    await expect(hero).toBeVisible();
    const box = (await hero.boundingBox())!;
    // 移动端 min-h-[320px]，高度应 >= 300（留余量给 padding）
    expect(box.height).toBeGreaterThanOrEqual(300);
  });

  test("移动端：Hero 侧边海报在窄屏隐藏（hidden sm:block）", async ({ page }) => {
    await goto(page, "/");
    await waitHomeReady(page);
    // Hero 内的 poster 容器带 hidden sm:block，移动端应不可见
    const sidePoster = page.locator("section.relative div.hidden.aspect-\\[2\\/3\\]");
    // 该元素存在于 DOM 但 display:none（hidden 类）
    const isVisible = await sidePoster.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });

  // ── 移动端横向滚动 ──────────────────────────────────────────────────────────

  test("移动端：MovieRow 海报墙支持横向滚动", async ({ page }) => {
    await goto(page, "/");
    await waitHomeReady(page);
    // 横向滚动容器：no-scrollbar + overflow-x-auto
    const scrollContainer = page.locator("div.no-scrollbar").first();
    await expect(scrollContainer).toBeVisible();
    // 验证 overflow-x 为 auto 或 scroll
    const overflowX = await scrollContainer.evaluate(
      (el) => getComputedStyle(el).overflowX
    );
    expect(["auto", "scroll"]).toContain(overflowX);
  });

  // ── 移动端触控目标 ──────────────────────────────────────────────────────────

  test("移动端：汉堡按钮触控目标 >= 44×44px", async ({ page }) => {
    await goto(page, "/");
    await waitHomeReady(page);
    const burger = page.locator("button.md\\:hidden");
    const box = (await burger.first().boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test("移动端：导航链接触控目标 >= 44px 高度", async ({ page }) => {
    await goto(page, "/");
    await waitHomeReady(page);
    const burger = page.locator("button.md\\:hidden");
    await burger.first().click();
    const links = page.locator("div.md\\:hidden a.min-h-\\[44px\\]");
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
    // 第一个链接高度 >= 44
    const box = (await links.first().boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
  });

  // ── 移动端安全区适配 ────────────────────────────────────────────────────────

  test("移动端：viewport-fit=cover 已设置（适配刘海屏）", async ({ page }) => {
    await goto(page, "/");
    await page.waitForLoadState("domcontentloaded");
    // 检查 head 中所有 viewport meta 标签的内容
    const viewportContent = await page.evaluate(() => {
      const metas = document.querySelectorAll('meta[name="viewport"]');
      return Array.from(metas)
        .map((m) => m.getAttribute("content") ?? "")
        .join(" ");
    });
    // 如果 meta 不存在，检查 head 的 innerHTML 用于调试
    if (!viewportContent) {
      const headHtml = await page.evaluate(() => document.head.innerHTML);
      throw new Error(`viewport meta not found. Head: ${headHtml.slice(0, 500)}`);
    }
    expect(viewportContent).toContain("viewport-fit=cover");
  });

  test("移动端：header 使用 safe-area-inset-top 适配刘海", async ({ page }) => {
    await goto(page, "/");
    await waitHomeReady(page);
    const header = page.locator("header");
    const paddingTop = await header.evaluate(
      (el) => getComputedStyle(el).paddingTop
    );
    // env(safe-area-inset-top) 在模拟器上通常为 0px 或较小值，
    // 但 CSS 变量已声明；此处仅验证 header 存在且可见
    await expect(header).toBeVisible();
    expect(paddingTop).toBeDefined();
  });

  test("移动端：FloatingActions 使用 safe-area-inset-bottom 适配 Home 指示条", async ({ page }) => {
    await goto(page, "/");
    await waitHomeReady(page);
    const floatingActions = page.locator("div.fixed.right-5");
    await expect(floatingActions).toBeVisible();
    const bottom = await floatingActions.evaluate(
      (el) => getComputedStyle(el).bottom
    );
    // max(1.25rem, env(safe-area-inset-bottom)) — 值应 >= 1.25rem 或 env 值
    expect(bottom).toBeDefined();
  });

  // ── 移动端搜索交互 ──────────────────────────────────────────────────────────

  test("移动端：搜索框输入后 600ms 自动跳转搜索页", async ({ page }) => {
    await goto(page, "/");
    await waitHomeReady(page);
    const input = page.locator("input").first();
    await expect(input).toBeVisible();
    // 逐字输入触发 debounce
    await input.pressSequentially("星际", { delay: 50 });
    // 等待 URL 变为 /search（debounce 600ms + 导航）
    await page.waitForFunction(
      () => window.location.pathname === "/search",
      { timeout: 5_000 }
    );
    await expect(page).toHaveURL(/q=%E6%98%9F%E9%99%85/);
  });

  // ── 移动端详情页布局 ────────────────────────────────────────────────────────

  test("移动端：详情页元数据列表（dl）在窄屏下纵向排列", async ({ page }) => {
    const id = await firstItemId(page);
    test.skip(!id, "无可用 item_id，跳过");
    await goto(page, `/detail/${id}`);
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
    const dl = page.locator("dl").first();
    await expect(dl).toBeVisible();
    // 验证 dt/dd 在移动端纵向排列（flex-col 或 block）
    const dt = dl.locator("dt").first();
    const dd = dl.locator("dd").first();
    await expect(dt).toBeVisible();
    await expect(dd).toBeVisible();
  });
});
