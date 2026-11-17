import { describe, expect, test } from "bun:test";

import { STEP, lack, scale } from "./scale";

describe("scale", () => {
  test("steps the zoom and keeps it in range", () => {
    expect(scale(1 + STEP)).toBe(1.1);
    expect(scale(0.5)).toBe(0.8);
    expect(scale(3)).toBe(1.6);
    expect(scale(1.04)).toBe(1);
  });

  test("finds an agent that isn't installed", () => {
    expect(lack(null, "claude")).toBeNull();
    const found = [
      { agent: "claude", version: "2.1.89" },
      { agent: "codex", version: null },
    ];
    expect(lack(found, "claude")).toBeNull();
    expect(lack(found, "codex")).toEqual({ agent: "codex", version: null });
  });
});
