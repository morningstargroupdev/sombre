import { describe, expect, test } from "bun:test";

import type { Chat } from "./api";
import { pick, save } from "./resume";

const chat = (agent: Chat["agent"], id: string): Chat => ({
  agent,
  ago: "now",
  folder: "/work",
  id,
  place: "~/work",
  project: "work",
  title: "fix it",
  updated: 0,
});

describe("resume", () => {
  test("finds the chat that was open last time", () => {
    const chats = [chat("claude", "a"), chat("codex", "b")];
    expect(pick(save("codex", "b"), chats)).toEqual(chats[1] ?? null);
    expect(pick(save("codex", "gone"), chats)).toBeNull();
    expect(pick("not json", chats)).toBeNull();
    expect(pick(null, chats)).toBeNull();
  });
});
