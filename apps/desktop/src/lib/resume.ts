import type { Agent, Chat } from "./api";

export const SAVED = "sombre.last";

export const pick = (raw: string | null, chats: Chat[]) => {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (typeof value !== "object" || value === null) {
      return null;
    }
    const agent: unknown = Reflect.get(value, "agent");
    const id: unknown = Reflect.get(value, "id");
    return chats.find((chat) => chat.agent === agent && chat.id === id) ?? null;
  } catch {
    return null;
  }
};

export const save = (agent: Agent, id: string) => JSON.stringify({ agent, id });
