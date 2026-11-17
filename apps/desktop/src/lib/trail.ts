import { useEffect, useRef } from "react";

import { pressed } from "./platform";

export interface Trail<T> {
  items: T[];
  at: number;
}

const KEPT = 50;

export const visit = <T extends { key: string }>(
  trail: Trail<T>,
  item: T
): Trail<T> => {
  if (trail.items[trail.at]?.key === item.key) {
    const items = [...trail.items];
    items[trail.at] = item;
    return { at: trail.at, items };
  }
  const items = [...trail.items.slice(0, trail.at + 1), item].slice(-KEPT);
  return { at: items.length - 1, items };
};

export const step = <T>(trail: Trail<T>, by: number): Trail<T> | null => {
  const at = trail.at + by;
  return at >= 0 && at < trail.items.length ? { ...trail, at } : null;
};

export const useTrail = <T extends { key: string }>(
  open: T | null,
  go: (item: T) => void
) => {
  const trail = useRef<Trail<T>>({ at: -1, items: [] });
  const walking = useRef(false);

  useEffect(() => {
    if (open && !walking.current) {
      trail.current = visit(trail.current, open);
    }
    walking.current = false;
  }, [open]);

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      const by = pressed(event, "[") ? -1 : 0;
      const moved = pressed(event, "]") ? 1 : by;
      if (moved === 0) {
        return;
      }
      const next = step(trail.current, moved);
      const item = next?.items[next.at];
      event.preventDefault();
      if (next && item) {
        trail.current = next;
        walking.current = true;
        go(item);
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [go]);
};
