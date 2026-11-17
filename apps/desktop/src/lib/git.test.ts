import { describe, expect, test } from "bun:test";

import { counted, suggest } from "./git";

describe("git copy", () => {
  test("suggests a commit message from the changed files", () => {
    expect(suggest([])).toBe("");
    expect(suggest(["src/app.tsx"])).toBe("update app.tsx");
    expect(suggest(["a.md", "lib/b.ts"])).toBe("update a.md and b.ts");
    expect(suggest(["a.md", "b.md", "c.md", "d.md"])).toBe(
      "update a.md and 3 more files"
    );
  });

  test("counts in words", () => {
    expect(counted(1, "file", "files")).toBe("1 file");
    expect(counted(4, "file", "files")).toBe("4 files");
  });
});
