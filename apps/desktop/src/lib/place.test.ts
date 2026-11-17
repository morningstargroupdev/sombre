import { describe, expect, test } from "bun:test";

import { GAP, fit } from "./place";

const view = { height: 800, width: 1200 };
const chip = (top: number, left = 600) => ({
  bottom: top + 28,
  left,
  right: left + 120,
  top,
});

describe("fit", () => {
  test("opens on the asked side when the menu fits", () => {
    const spot = fit(
      chip(100),
      { height: 300, width: 240 },
      view,
      "bottom",
      "start"
    );
    expect(spot.top).toBe(128 + GAP);
    expect(spot.bottom).toBeNull();
    expect(spot.height).toBe(420);
    expect(spot.left).toBe(600);
  });

  test("flips up when there is more room above", () => {
    const spot = fit(
      chip(600),
      { height: 400, width: 240 },
      view,
      "bottom",
      "start"
    );
    expect(spot.top).toBeNull();
    expect(spot.bottom).toBe(800 - 600 + GAP);
    expect(spot.height).toBe(420);
  });

  test("shrinks to the room it has instead of leaving the window", () => {
    const spot = fit(
      chip(380),
      { height: 600, width: 240 },
      view,
      "bottom",
      "start"
    );
    expect(spot.top).toBe(408 + GAP);
    expect(spot.height).toBe(800 - 408 - GAP - 8);
  });

  test("keeps the menu inside the window sideways", () => {
    expect(
      fit(chip(100, 1150), { height: 200, width: 240 }, view, "bottom", "start")
        .left
    ).toBe(1200 - 240 - 8);
    expect(
      fit(chip(100, 4), { height: 200, width: 240 }, view, "bottom", "end").left
    ).toBe(8);
    expect(
      fit(chip(100, 600), { height: 200, width: 240 }, view, "bottom", "end")
        .left
    ).toBe(720 - 240);
  });

  test("keeps its side while following a scroll", () => {
    const spot = fit(
      chip(600),
      { height: 400, width: 240 },
      view,
      "bottom",
      "start",
      false
    );
    expect(spot.top).toBe(628 + GAP);
    expect(spot.height).toBe(800 - 628 - GAP - 8);
  });

  test("a menu that opens upward stays up when it fits", () => {
    const spot = fit(
      chip(700),
      { height: 200, width: 240 },
      view,
      "top",
      "start"
    );
    expect(spot.bottom).toBe(800 - 700 + GAP);
    expect(spot.top).toBeNull();
  });
});
