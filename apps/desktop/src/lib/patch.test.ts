import { describe, expect, test } from "bun:test";

import { parse, split, totals } from "./patch";

const sample = [
  "diff --git a/src/app.ts b/src/app.ts",
  "index 1111111..2222222 100644",
  "--- a/src/app.ts",
  "+++ b/src/app.ts",
  "@@ -3,4 +3,5 @@ export const app = () => {",
  " const one = 1;",
  "-const two = 2;",
  "+const two = 3;",
  "+const three = 3;",
  " return one;",
  "\\ No newline at end of file",
  "diff --git a/new.md b/new.md",
  "new file mode 100644",
  "index 0000000..3333333",
  "--- /dev/null",
  "+++ b/new.md",
  "@@ -0,0 +1 @@",
  "+hello",
  "diff --git a/old.txt b/old.txt",
  "deleted file mode 100644",
  "--- a/old.txt",
  "+++ /dev/null",
  "@@ -1 +0,0 @@",
  "-bye",
  "diff --git a/a.rs b/b.rs",
  "similarity index 90%",
  "rename from a.rs",
  "rename to b.rs",
  "diff --git a/logo.png b/logo.png",
  "Binary files a/logo.png and b/logo.png differ",
  "",
].join("\n");

describe("parse", () => {
  const files = parse(sample);

  test("reads every file with its status", () => {
    expect(files.map((file) => [file.path, file.status])).toEqual([
      ["src/app.ts", "modified"],
      ["new.md", "added"],
      ["old.txt", "deleted"],
      ["b.rs", "renamed"],
      ["logo.png", "modified"],
    ]);
    expect(files[3]?.from).toBe("a.rs");
    expect(files[4]?.binary).toBe(true);
  });

  test("numbers old and new lines through a hunk", () => {
    const lines = files[0]?.hunks[0]?.lines ?? [];
    expect(lines.map((line) => [line.kind, line.old, line.now])).toEqual([
      ["same", 3, 3],
      ["gone", 4, null],
      ["add", null, 4],
      ["add", null, 5],
      ["same", 5, 6],
    ]);
    expect(files[0]?.added).toBe(2);
    expect(files[0]?.removed).toBe(1);
  });

  test("adds up totals and splits paths for display", () => {
    expect(totals(files)).toEqual({ added: 3, removed: 2 });
    expect(split("src/lib/patch.ts")).toEqual({
      folder: "src/lib/",
      name: "patch.ts",
    });
    expect(split("README.md")).toEqual({ folder: "", name: "README.md" });
  });
});
