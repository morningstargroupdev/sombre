import type { Chat } from "./api";
import { matches } from "./feed";

export interface Prefs {
  pinned: string[];
  archived: string[];
  folded: string[];
  opened: string[];
  hidden: boolean;
  width: number;
}

export interface Project {
  folder: string;
  name: string;
  place: string;
  chats: Chat[];
  more: number;
}

export interface Sections {
  pinned: Chat[];
  projects: Project[];
  total: number;
}

export const LIMIT = 5;

export const WIDTH = 272;

export const widen = (value: number) =>
  Math.round(Math.min(420, Math.max(220, value)));

export const blank: Prefs = {
  archived: [],
  folded: [],
  hidden: false,
  opened: [],
  pinned: [],
  width: WIDTH,
};

const strings = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

export const parse = (raw: string | null): Prefs => {
  try {
    const value: unknown = JSON.parse(raw ?? "{}");
    if (typeof value !== "object" || value === null) {
      return blank;
    }
    const field = (name: string): unknown => Reflect.get(value, name);
    return {
      archived: strings(field("archived")),
      folded: strings(field("folded")),
      hidden: field("hidden") === true,
      opened: strings(field("opened")),
      pinned: strings(field("pinned")),
      width:
        typeof field("width") === "number"
          ? widen(Number(field("width")))
          : WIDTH,
    };
  } catch {
    return blank;
  }
};

export const toggle = (list: string[], item: string) =>
  list.includes(item)
    ? list.filter((entry) => entry !== item)
    : [...list, item];

export const keyed = (chat: Chat) => `${chat.agent}:${chat.id}`;

export const short = (ago: string) => ago.replace(/ ago$/u, "");

export const sections = (
  chats: Chat[],
  prefs: Prefs,
  query: string,
  current: string | null
): Sections => {
  const kept = chats.filter(
    (chat) => !prefs.archived.includes(keyed(chat)) && matches(chat, query)
  );
  const pinned = kept.filter((chat) => prefs.pinned.includes(keyed(chat)));
  const rest = kept.filter((chat) => !prefs.pinned.includes(keyed(chat)));
  const folders = new Map<string, Chat[]>();
  for (const chat of rest) {
    folders.set(chat.folder, [...(folders.get(chat.folder) ?? []), chat]);
  }
  const searching = query.trim() !== "";
  const projects = [...folders.entries()].map(([folder, list]) => {
    const all = searching || prefs.opened.includes(folder);
    const shown = all
      ? list
      : list.filter((chat, index) => index < LIMIT || keyed(chat) === current);
    const [first] = list;
    return {
      chats: shown,
      folder,
      more: list.length - shown.length,
      name: first?.project ?? folder,
      place: first?.place ?? folder,
    };
  });
  return { pinned, projects, total: kept.length };
};
