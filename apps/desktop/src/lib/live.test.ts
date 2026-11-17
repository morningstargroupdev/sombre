import { describe, expect, test } from "bun:test";

import type { Update } from "./api";
import {
  answered,
  apply,
  asked,
  initial,
  mark,
  marked,
  marks,
  restored,
  said,
  seconds,
  steering,
  waiting,
} from "./live";

const run = (updates: Update[], start = initial()) => {
  let live = start;
  for (const update of updates) {
    live = apply(live, update, 1000);
  }
  return live;
};

const state = (busy: boolean): Extract<Update, { kind: "state" }> => ({
  busy,
  cost: 0.5,
  effort: "high",
  folder: "/work",
  goal: null,
  kind: "state",
  left: 40,
  levels: ["low", "high"],
  mode: "auto",
  model: "opus",
  session: "s1",
});

describe("apply", () => {
  test("marks a chat as working, waiting, new, or failed", () => {
    const working = run([state(true)]);
    expect(mark(working, false)).toBe("busy");
    const asking = run([
      state(true),
      {
        always: null,
        change: [],
        detail: "rm -rf build",
        id: "a1",
        kind: "ask",
        reason: "",
        tool: "Bash",
      },
    ]);
    expect(mark(asking, false)).toBe("ask");
    const finished = run([
      state(true),
      { kind: "text", text: "ok" },
      state(false),
    ]);
    expect(mark(finished, false)).toBeNull();
    expect(mark(finished, true)).toBe("new");
    const broke = run([
      state(true),
      { kind: "failed", text: "no" },
      state(false),
    ]);
    expect(mark(broke, true)).toBe("failed");
    expect(marks("claude:a=busy\nfresh:1=ask\n")).toEqual(
      new Map([
        ["claude:a", "busy"],
        ["fresh:1", "ask"],
      ])
    );
  });

  test("keeps the goal the runner reports and drops it when cleared", () => {
    const aim = {
      active: true,
      objective: "tests pass",
      status: "active",
      summary: "pursuing the goal, turn 2 of 20",
    };
    const going = run([{ ...state(true), goal: aim }]);
    expect(going.goal).toEqual(aim);
    expect(run([{ ...state(true), goal: aim }, state(false)]).goal).toBeNull();
  });

  test("streams deltas into one reply and settles on the final text", () => {
    const live = run([
      { kind: "delta", text: "hel" },
      { kind: "delta", text: "lo" },
      { kind: "text", text: "hello." },
    ]);
    expect(live.entries).toEqual([
      { id: 1_000_000, kind: "text", text: "hello." },
    ]);
    expect(live.open).toBe(false);
  });

  test("starts a new reply after a step", () => {
    const live = run([
      { kind: "delta", text: "looking" },
      { detail: "ls", kind: "step", label: "Run", step: "1" },
      { kind: "delta", text: "found it" },
    ]);
    expect(live.entries.map((entry) => entry.kind)).toEqual([
      "text",
      "step",
      "text",
    ]);
  });

  test("folds output and patches into their step", () => {
    const live = run([
      { detail: "cargo test", kind: "step", label: "Run", step: "1" },
      { detail: "src/main.rs", kind: "step", label: "Edit", step: "2" },
      { failed: true, kind: "output", step: "1", text: "1 failed" },
      { kind: "patch", lines: ["+fixed"], step: "2" },
      { failed: false, kind: "output", step: "missing", text: "ignored" },
    ]);
    const [first, second] = live.entries;
    expect(first?.kind === "step" && first.output).toBe("1 failed");
    expect(first?.kind === "step" && first.failed).toBe(true);
    expect(second?.kind === "step" && second.patch).toEqual(["+fixed"]);
    expect(live.entries).toHaveLength(2);
  });

  test("updates the plan in place within a turn", () => {
    const live = run([
      { kind: "plan", tasks: [{ status: "pending", text: "read" }] },
      { kind: "plan", tasks: [{ status: "completed", text: "read" }] },
    ]);
    expect(live.entries).toHaveLength(1);
    const next = run([{ kind: "plan", tasks: [] }], said(live, "again"));
    expect(next.entries.map((entry) => entry.kind)).toEqual([
      "plan",
      "user",
      "plan",
    ]);
  });

  test("tracks the turn clock from busy to idle", () => {
    const busy = apply(initial(), state(true), 5000);
    expect(busy.since).toBe(5000);
    expect(apply(busy, state(true), 9000).since).toBe(5000);
    expect(apply(busy, state(false), 9000).since).toBeNull();
    expect(busy.model).toBe("opus");
    expect(busy.session).toBe("s1");
  });
});

describe("approvals", () => {
  test("waits on the first unanswered ask", () => {
    const live = run([
      {
        always: null,
        change: [],
        detail: "rm -rf build",
        id: "a1",
        kind: "ask",
        reason: "",
        tool: "Bash",
      },
    ]);
    expect(waiting(live)?.ask).toBe("a1");
    expect(waiting(answered(live, "a1", "yes"))).toBeUndefined();
  });

  test("a mode switch that covers the ask settles it as allowed", () => {
    const live = run([
      {
        always: null,
        change: [],
        detail: "cargo test",
        id: "a2",
        kind: "ask",
        reason: "",
        tool: "Bash",
      },
      { id: "a2", kind: "granted" },
    ]);
    expect(waiting(live)).toBeUndefined();
    expect(live.entries.at(-1)).toMatchObject({ answer: "yes", ask: "a2" });
  });

  test("titles each kind of approval", () => {
    expect(asked("Bash")).toBe("run this command?");
    expect(asked("Write")).toBe("make this edit?");
    expect(asked("WebSearch")).toBe("go on the web?");
    expect(asked("mcp__notion")).toBe("use mcp__notion?");
  });
});

describe("queue", () => {
  test("puts queued messages back into the draft after a stop", () => {
    const live = {
      ...initial(),
      queue: [
        { images: [], text: "first" },
        { images: [], text: " " },
      ],
      stopping: true,
    };
    const back = restored(live, "and this");
    expect(back.draft).toBe("first\nand this");
    expect(back.live).toMatchObject({ queue: [], restore: 1, stopping: false });
  });
});

describe("seconds", () => {
  test("counts whole seconds since the turn started", () => {
    expect(seconds(null, 5000)).toBe(0);
    expect(seconds(1000, 13_999)).toBe(12);
  });
});

describe("images", () => {
  test("numbers images after the text for the agent", () => {
    expect(marked("what is this", 2)).toBe(
      "what is this [Image #1] [Image #2]"
    );
    expect(marked("", 1)).toBe("[Image #1]");
    expect(marked("plain", 0)).toBe("plain");
  });

  test("shows a sent message with its pictures", () => {
    const live = said(initial(), "look", false, ["data:image/png;base64,x"]);
    expect(live.entries[0]).toMatchObject({
      images: ["data:image/png;base64,x"],
      kind: "user",
      text: "look",
    });
  });
});

describe("steering", () => {
  test("sends text now and keeps messages with images for after the turn", () => {
    const picture = { path: "/tmp/a.png", src: "data:image/png;base64,x" };
    const { kept, message, sent } = steering([
      { images: [], text: "first" },
      { images: [picture], text: "look at this" },
      { images: [], text: "second\n\nwith a gap" },
    ]);
    expect(message).toBe("first\n\nsecond\n\nwith a gap");
    expect(sent.map((queued) => queued.text)).toEqual([
      "first",
      "second\n\nwith a gap",
    ]);
    expect(kept.map((queued) => queued.text)).toEqual(["look at this"]);
  });
});
