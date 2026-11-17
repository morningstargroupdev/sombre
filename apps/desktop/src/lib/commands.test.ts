import { describe, expect, test } from "bun:test";

import { rotate } from "./api";
import { parse, suggest } from "./commands";

describe("slash commands", () => {
  test("suggests commands while the name is being typed", () => {
    expect(suggest("/").length).toBeGreaterThan(5);
    expect(suggest("/re").map((command) => command.name)).toEqual([
      "rename",
      "review",
      "reveal",
    ]);
    expect(suggest("/rename x")).toEqual([]);
    expect(suggest("hello")).toEqual([]);
  });

  test("parses known and unknown commands with their arguments", () => {
    expect(parse("/rename  deploy fix ")).toEqual({
      known: true,
      name: "rename",
      rest: "deploy fix",
    });
    expect(parse("/compact")).toEqual({
      known: true,
      name: "compact",
      rest: "",
    });
    expect(parse("/goal `bun test` passes")).toEqual({
      known: true,
      name: "goal",
      rest: "`bun test` passes",
    });
    expect(parse("/agent codex")).toEqual({
      known: true,
      name: "agent",
      rest: "codex",
    });
    expect(parse("/deploy now")).toEqual({
      known: false,
      name: "deploy",
      rest: "now",
    });
    expect(parse("not a command")).toBeNull();
    expect(parse("/")).toBeNull();
  });
});

describe("permissions", () => {
  test("shift tab steps through ask, auto, and yolo, then back to ask", () => {
    expect(rotate("ask")).toBe("auto");
    expect(rotate("auto")).toBe("yolo");
    expect(rotate("yolo")).toBe("ask");
  });
});
