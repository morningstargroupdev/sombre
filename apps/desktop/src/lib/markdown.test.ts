import { describe, expect, test } from "bun:test";

import { markdown } from "./markdown";

const kinds = (source: string) => markdown(source).map((block) => block.kind);

describe("markdown", () => {
  test("splits blocks the same way the phone page does", () => {
    expect(
      kinds(
        "# title\n\nsome text\nmore text\n\n- one\n- two\n\n```ts\nconst a = 1\n```\n\n---\n\n> quoted\n\n| a | b |\n| - | - |\n| 1 | 2 |"
      )
    ).toEqual([
      "heading",
      "paragraph",
      "list",
      "code",
      "rule",
      "quote",
      "table",
    ]);
  });

  test("keeps fenced code untouched", () => {
    expect(markdown("```rust\nfn main() {}\n  **not bold**\n```")).toEqual([
      {
        key: 1,
        kind: "code",
        language: "rust",
        text: "fn main() {}\n  **not bold**",
      },
    ]);
  });

  test("reads inline code, bold, italic, and links", () => {
    const [block] = markdown(
      "run `bun test` **now**, *gently*, see [docs](https://sombre.ai)"
    );
    expect(
      block?.kind === "paragraph" ? block.spans.map((span) => span.kind) : []
    ).toEqual(["text", "code", "text", "strong", "text", "em", "text", "link"]);
  });

  test("shows only the label of links that are not http, and never makes them clickable", () => {
    const [script] = markdown("[click](javascript:alert(1))");
    expect(
      script?.kind === "paragraph" ? script.spans.map((span) => span.kind) : []
    ).toEqual(["path", "text"]);
    const [file] = markdown(
      "Created [notes.md](/work/notes.md) with three bullets"
    );
    expect(file?.kind === "paragraph" ? file.spans : []).toEqual([
      { key: expect.any(Number), kind: "text", text: "Created " },
      {
        href: "/work/notes.md",
        key: expect.any(Number),
        kind: "path",
        text: "notes.md",
      },
      { key: expect.any(Number), kind: "text", text: " with three bullets" },
    ]);
  });

  test("joins wrapped list lines and spots ordered lists", () => {
    const [block] = markdown("1. first\n   still first\n2. second");
    expect(block?.kind === "list" && block.ordered).toBe(true);
    expect(block?.kind === "list" ? block.items.length : 0).toBe(2);
  });

  test("drops the table divider row", () => {
    const [block] = markdown("| a | b |\n|---|:-:|\n| 1 | 2 |");
    expect(block?.kind === "table" ? block.rows.length : 0).toBe(2);
  });

  test("gives every block and span a unique key", () => {
    const keys = markdown("a\nb\n\n- c\n- d").flatMap((block) => [
      block.key,
      ...(block.kind === "paragraph"
        ? block.spans.map((span) => span.key)
        : []),
      ...(block.kind === "list"
        ? block.items.flatMap((item) => [
            item.key,
            ...item.spans.map((span) => span.key),
          ])
        : []),
    ]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("turns box drawing in inline code into a rule", () => {
    const [block] = markdown("`★ Insight ─────`\ntext\n`─────────`");
    expect(
      block?.kind === "paragraph"
        ? block.spans.map((span) =>
            span.kind === "code" ? span.text : span.kind
          )
        : []
    ).toEqual(["★ Insight", "break", "text", "break", "rule"]);
  });
});
