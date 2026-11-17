import { describe, expect, test } from "bun:test";

import { rank } from "./fuzzy";
import { insert, token } from "./mention";

const paths = [
  "apps/desktop/src/app.tsx",
  "apps/desktop/src/components/composer.tsx",
  "apps/web/app/page.tsx",
  "crates/cli/src/chat.rs",
  "README.md",
];

describe("rank", () => {
  test("puts file names that start with the query first", () => {
    expect(rank("app", paths).map((hit) => hit.path)[0]).toBe(
      "apps/desktop/src/app.tsx"
    );
    expect(rank("comp", paths)[0]?.path).toBe(
      "apps/desktop/src/components/composer.tsx"
    );
  });

  test("matches letters in order and marks where they hit", () => {
    const [hit] = rank("chrs", paths);
    expect(hit?.path).toBe("crates/cli/src/chat.rs");
    expect(hit?.marks.length).toBe(4);
    expect(rank("zzz", paths)).toEqual([]);
  });

  test("an empty query lists files in order", () => {
    expect(rank("", paths, 2).map((hit) => hit.path)).toEqual(
      paths.slice(0, 2)
    );
  });
});

describe("mentions", () => {
  test("finds the @ word under the caret", () => {
    expect(token("look at @src/ap", 15)).toEqual({ query: "src/ap", start: 8 });
    expect(token("@", 1)).toEqual({ query: "", start: 0 });
    expect(token("mail me@home", 12)).toBeNull();
    expect(token("done @x then", 12)).toBeNull();
  });

  test("swaps the word for the picked path and moves the caret", () => {
    expect(insert("look at @ap please", 11, 8, "src/app.ts")).toEqual({
      caret: 20,
      text: "look at @src/app.ts please",
    });
    expect(insert("@", 1, 0, "README.md")).toEqual({
      caret: 11,
      text: "@README.md ",
    });
  });
});
