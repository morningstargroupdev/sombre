import { describe, expect, test } from "bun:test";

import { clip, diff, encode, money, pictures } from "./format";

describe("money", () => {
  test("matches the cli", () => {
    expect(money(null)).toBe("");
    expect(money(0)).toBe("");
    expect(money(0.004)).toBe("<$0.01");
    expect(money(1.256)).toBe("$1.26");
  });
});

describe("clip", () => {
  test("keeps the first lines and counts the rest", () => {
    expect(clip("a\nb\nc\n", 2)).toEqual({ hidden: 1, lines: ["a", "b"] });
    expect(clip("a", 5)).toEqual({ hidden: 0, lines: ["a"] });
  });
});

describe("diff", () => {
  test("keys and tones each line", () => {
    expect(diff(["+new", "-old", " same"])).toEqual([
      { key: 0, text: "+new", tone: "add" },
      { key: 1, text: "-old", tone: "gone" },
      { key: 2, text: " same", tone: "same" },
    ]);
  });
});

describe("images", () => {
  test("encodes large images in chunks", () => {
    const data = Uint8Array.from(
      { length: 100_000 },
      (_, index) => index % 256
    );
    expect(encode(data)).toBe(Buffer.from(data).toString("base64"));
  });

  test("keeps only image paths from a drop", () => {
    expect(
      pictures(["/a/shot.PNG", "/a/notes.md", "/a/photo.jpeg", "/a/clip.webp"])
    ).toEqual(["/a/shot.PNG", "/a/photo.jpeg", "/a/clip.webp"]);
  });
});
