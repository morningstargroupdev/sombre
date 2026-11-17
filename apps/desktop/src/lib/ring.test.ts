import { describe, expect, test } from "bun:test";

import { ring } from "./ring";

describe("context ring", () => {
  test("fills by how much context is used", () => {
    expect(ring(100).dash).toBe("0 31.42");
    expect(ring(50).dash).toBe("15.71 31.42");
    expect(ring(0).dash).toBe("31.42 31.42");
    expect(ring(-10).dash).toBe("31.42 31.42");
  });

  test("warns when little is left", () => {
    expect(ring(19).low).toBe(true);
    expect(ring(20).low).toBe(false);
  });
});
