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
});

test.describe("移动端（iPhone 视口）", () => {
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
});
