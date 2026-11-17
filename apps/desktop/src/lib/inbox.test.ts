import { describe, expect, test } from "bun:test";

import type { Chat } from "./api";
import {
  IDLE,
  left,
  settle,
  shelf,
  snooze,
  unread,
  unsettle,
  wake,
  wakes,
  woke,
} from "./inbox";

const NOW = 1_800_000_000;

const chat = (updated: number): Chat => ({
  agent: "claude",
  ago: "",
  folder: "/w/app",
  id: "c1",
  place: "~/app",
  project: "app",
  title: "fix the build",
  updated,
});

const empty = { settled: {}, snoozed: {} };

describe("shelf", () => {
  test("recent chats sit in the inbox and quiet ones settle on their own", () => {
    expect(shelf(chat(NOW - 60), "k", empty, null, NOW)).toBe("inbox");
    expect(shelf(chat(NOW - IDLE - 1), "k", empty, null, NOW)).toBe("settled");
    expect(shelf(chat(NOW - IDLE - 1), "k", empty, "busy", NOW)).toBe("inbox");
  });

  test("settling holds until something new happens", () => {
    const marks = settle(empty, "k", NOW - 60);
    expect(shelf(chat(NOW - 60), "k", marks, null, NOW)).toBe("settled");
    expect(shelf(chat(NOW - 5), "k", marks, null, NOW)).toBe("inbox");
    expect(shelf(chat(NOW - 60), "k", unsettle(marks, "k"), null, NOW)).toBe(
      "inbox"
    );
  });

  test("a snooze hides the chat until it wakes, or until it needs you", () => {
    const marks = snooze(settle(empty, "k", NOW), "k", NOW + 3600);
    expect(marks.settled).toEqual({});
    expect(shelf(chat(NOW), "k", marks, null, NOW)).toBe("snoozed");
    expect(shelf(chat(NOW), "k", marks, "busy", NOW)).toBe("snoozed");
    expect(shelf(chat(NOW), "k", marks, "ask", NOW)).toBe("inbox");
    expect(shelf(chat(NOW), "k", marks, "failed", NOW)).toBe("inbox");
    expect(shelf(chat(NOW - IDLE * 2), "k", marks, null, NOW + 7200)).toBe(
      "inbox"
    );
    expect(wake(marks, "k").snoozed).toEqual({});
  });

  test("settling a snoozed chat ends the snooze", () => {
    const marks = settle(snooze(empty, "k", NOW + 60), "k", NOW);
    expect(marks.snoozed).toEqual({});
    expect(shelf(chat(NOW), "k", marks, null, NOW)).toBe("settled");
  });
});

describe("marks", () => {
  test("a woken chat is tagged until it's seen after waking", () => {
    expect(woke(NOW - 10, NOW - 100, NOW)).toBe(true);
    expect(woke(NOW - 10, NOW - 5, NOW)).toBe(false);
    expect(woke(NOW + 10, 0, NOW)).toBe(false);
    expect(woke(undefined, 0, NOW)).toBe(false);
  });

  test("unread means it changed since it was last seen", () => {
    expect(unread(chat(NOW), NOW - 1)).toBe(true);
    expect(unread(chat(NOW), NOW)).toBe(false);
  });
});

describe("wakes", () => {
  test("offers the next sensible times in local time", () => {
    const tuesday = new Date(2026, 10, 17, 10, 0, 0);
    const labels = wakes(tuesday).map((option) => option.label);
    expect(labels).toEqual([
      "in 1 hour",
      "in 3 hours",
      "this evening",
      "tomorrow morning",
      "next week",
    ]);
    const monday = wakes(tuesday).at(-1);
    expect(monday && new Date(monday.until * 1000).getDay()).toBe(1);
    expect(monday && new Date(monday.until * 1000).getHours()).toBe(9);
  });

  test("drops times that already passed or land together", () => {
    const night = new Date(2026, 10, 17, 21, 0, 0);
    expect(wakes(night).map((option) => option.label)).toEqual([
      "in 1 hour",
      "in 3 hours",
      "tomorrow morning",
      "next week",
    ]);
    const late = new Date(2026, 10, 17, 15, 0, 0);
    expect(wakes(late).map((option) => option.label)).toEqual([
      "in 1 hour",
      "in 3 hours",
      "tomorrow morning",
      "next week",
    ]);
  });
});

describe("left", () => {
  test("counts down in the largest unit that fits", () => {
    expect(left(NOW + 20, NOW)).toBe("1m");
    expect(left(NOW + 45 * 60, NOW)).toBe("45m");
    expect(left(NOW + 3 * 3600, NOW)).toBe("3h");
    expect(left(NOW + 3 * 86_400, NOW)).toBe("3d");
  });
});
