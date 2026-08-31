import { describe, it, expect } from "vitest";
import { splitMultiValue } from "@/lib/split";

describe("splitMultiValue", () => {
  it("空值 / 未定义 / 纯空白返回空数组", () => {
    expect(splitMultiValue(undefined)).toEqual([]);
    expect(splitMultiValue(null)).toEqual([]);
    expect(splitMultiValue("")).toEqual([]);
    expect(splitMultiValue("   ")).toEqual([]);
  });

  it("按 / 拆分并 trim 前后空白", () => {
    expect(splitMultiValue("科幻/动画/奇幻")).toEqual(["科幻", "动画", "奇幻"]);
    expect(splitMultiValue("A / B / C")).toEqual(["A", "B", "C"]);
  });

  it("兼容中文逗号与顿号", () => {
    expect(splitMultiValue("美国，英国")).toEqual(["美国", "英国"]);
    expect(splitMultiValue("张艺谋、陈凯歌")).toEqual(["张艺谋", "陈凯歌"]);
  });

  it("兼容英文逗号", () => {
    expect(splitMultiValue("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("单一值原样返回（无分隔符）", () => {
    expect(splitMultiValue("克里斯托弗·诺兰")).toEqual(["克里斯托弗·诺兰"]);
  });

  it("过滤连续分隔符产生的空项", () => {
    expect(splitMultiValue("科幻//动画")).toEqual(["科幻", "动画"]);
    expect(splitMultiValue("/动画/")).toEqual(["动画"]);
  });
});
