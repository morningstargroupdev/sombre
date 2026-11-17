import { describe, expect, test } from "bun:test";

import type { Trail } from "./trail";
import { step, visit } from "./trail";

const item = (key: string) => ({ key });

describe("trail", () => {
  test("goes back and forward through visited chats", () => {
    let trail: Trail<{ key: string }> = { at: -1, items: [] };
    for (const key of ["a", "b", "c"]) {
      trail = visit(trail, item(key));
    }
    const back = step(trail, -1);
    expect(back?.items[back.at]?.key).toBe("b");
    expect(step(trail, 1)).toBeNull();
    const branched = visit(back ?? trail, item("d"));
    expect(branched.items.map((entry) => entry.key)).toEqual(["a", "b", "d"]);
    expect(visit(branched, item("d")).items.length).toBe(3);
  });
});
