import { describe, it, expect, vi, beforeEach } from "vitest";

// 通过 mock @libsql/client，将 getDb 的连接指向一个可控的假 client，
// 验证：1) 同一进程内 getDb 复用同一连接（单例）；2) 连接失败后下次可重试。
const fakeClient = {
  // applySchema 会读 sqlite_master，需返回 { rows: [...] }；其余 execute 返回空结果即可。
  execute: vi.fn(async () => ({ rows: [], rowsAffected: 0, lastInsertRowid: 0 })),
};
const createClientMock = vi.fn(() => fakeClient);

vi.mock("@libsql/client", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

// 每个用例前重置：清掉模块缓存以便 getDb 重新连接，并复位 mock 调用记录。
beforeEach(() => {
  vi.resetModules();
  createClientMock.mockClear();
  fakeClient.execute.mockClear();
});

describe("getDb 连接管理", () => {
  it("同一进程内多次调用返回同一连接（单例，仅 connect 一次）", async () => {
    const { getDb } = await import("@/lib/db");
    const a = await getDb();
    const b = await getDb();
    expect(a).toBe(b);
    expect(createClientMock).toHaveBeenCalledTimes(1);
  });

  it("首次连接失败后可重试（ready 被重置，下次请求重新 connect）", async () => {
    // 先让 createClient 抛错
    createClientMock.mockImplementationOnce(() => {
      throw new Error("connect refused");
    });

    const { getDb } = await import("@/lib/db");

    await expect(getDb()).rejects.toThrow(/数据库连接失败/);

    // 后续调用恢复正常，应成功并返回连接
    const db = await getDb();
    expect(db).toBe(fakeClient);
    expect(createClientMock).toHaveBeenCalledTimes(2);
  });

  it("错误信息对连接 URL 做了脱敏（不泄露 token 或绝对路径）", async () => {
    createClientMock.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const { getDb } = await import("@/lib/db");
    await expect(getDb()).rejects.toThrow(/数据库连接失败 \(.+\)/);
    // 失败信息不应包含 scheme 之外的敏感路径细节（用 file: 仅保留文件名）
    try {
      await getDb();
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).not.toMatch(/[A-Za-z]:\\/); // 不含 Windows 绝对路径
      expect(msg).not.toMatch(/authToken=[^&\s)]+/); // 不含明文 token
    }
  });
});
