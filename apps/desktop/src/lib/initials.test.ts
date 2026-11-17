import { describe, expect, test } from "bun:test";

import { initials } from "./initials";

describe("initials", () => {
  test("takes the first two letters of a one word project", () => {
    expect(initials("sombre")).toBe("SO");
    expect(initials("x")).toBe("X");
  });

  test("takes one letter from each of the first two words", () => {
    expect(initials("ai-studio")).toBe("AS");
    expect(initials("my_cool app")).toBe("MC");
    expect(initials("v5")).toBe("V5");
  });

  test("handles empty and non latin names", () => {
    expect(initials("")).toBe("");
    expect(initials("---")).toBe("");
    expect(initials("日本語")).toBe("日本");
  });
});
