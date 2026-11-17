import { useSyncExternalStore } from "react";

export interface Toast {
  id: number;
  title: string;
  body?: string;
  wrap?: boolean;
  action?: { label: string; run: () => void };
}

const KEPT = 4;

let shown: Toast[] = [];
let next = 1;
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) {
    listener();
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const toast = (item: Omit<Toast, "id">) => {
  const id = next;
  next += 1;
  shown = [...shown, { ...item, id }].slice(-KEPT);
  emit();
  return id;
};

export const dismiss = (id: number) => {
  shown = shown.filter((item) => item.id !== id);
  emit();
};

export const useToasts = () => useSyncExternalStore(subscribe, () => shown);
