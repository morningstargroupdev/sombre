import type { Chat } from "./api";
import type { Flag } from "./live";

export const IDLE = 7 * 24 * 60 * 60;

export const numbers = (value: unknown): Record<string, number> =>
  typeof value === "object" && value !== null
    ? Object.fromEntries(
        Object.entries(value).filter(
          (entry): entry is [string, number] =>
            typeof entry[1] === "number" && Number.isFinite(entry[1])
        )
      )
    : {};

export type Shelf = "inbox" | "snoozed" | "settled";

export interface Marks {
  settled: Record<string, number>;
  snoozed: Record<string, number>;
}

export const shelf = (
  chat: Chat,
  key: string,
  marks: Marks,
  flag: Flag | null,
  now: number
): Shelf => {
  const until = marks.snoozed[key];
  const urgent = flag === "ask" || flag === "failed";
  if (until !== undefined && until > now && !urgent) {
    return "snoozed";
  }
  if (flag !== null || until !== undefined) {
    return "inbox";
  }
  const settled = marks.settled[key];
  if (
    (settled !== undefined && settled >= chat.updated) ||
    now - chat.updated > IDLE
  ) {
    return "settled";
  }
  return "inbox";
};

export const woke = (until: number | undefined, seen: number, now: number) =>
  until !== undefined && until <= now && seen < until;

export const unread = (chat: Chat, seen: number) => chat.updated > seen;

const without = (record: Record<string, number>, key: string) =>
  Object.fromEntries(Object.entries(record).filter(([entry]) => entry !== key));

export const settle = (marks: Marks, key: string, updated: number): Marks => ({
  settled: { ...marks.settled, [key]: updated },
  snoozed: without(marks.snoozed, key),
});

export const unsettle = (marks: Marks, key: string): Marks => ({
  settled: without(marks.settled, key),
  snoozed: marks.snoozed,
});

export const snooze = (marks: Marks, key: string, until: number): Marks => ({
  settled: without(marks.settled, key),
  snoozed: { ...marks.snoozed, [key]: until },
});

export const wake = (marks: Marks, key: string): Marks => ({
  settled: marks.settled,
  snoozed: without(marks.snoozed, key),
});

export interface Wake {
  label: string;
  until: number;
}

const seconds = (date: Date) => Math.floor(date.getTime() / 1000);

const at = (now: Date, days: number, hour: number) => {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
};

export const wakes = (now: Date): Wake[] => {
  const monday = (8 - now.getDay()) % 7 || 7;
  const options: Wake[] = [
    { label: "in 1 hour", until: seconds(now) + 3600 },
    { label: "in 3 hours", until: seconds(now) + 3 * 3600 },
    { label: "this evening", until: seconds(at(now, 0, 18)) },
    { label: "tomorrow morning", until: seconds(at(now, 1, 9)) },
    { label: "next week", until: seconds(at(now, monday, 9)) },
  ];
  const minutes = new Set<number>();
  return options.filter((option) => {
    const minute = Math.floor(option.until / 60);
    if (option.until <= seconds(now) + 60 || minutes.has(minute)) {
      return false;
    }
    minutes.add(minute);
    return true;
  });
};

export const left = (until: number, now: number) => {
  const minutes = Math.max(1, Math.ceil((until - now) / 60));
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours}h` : `${Math.round(hours / 24)}d`;
};
