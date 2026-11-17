import { files } from "./api";

const lists = new Map<string, Promise<string[]>>();

window.addEventListener("focus", () => lists.clear());

export const known = (folder: string) => {
  const cached = lists.get(folder);
  if (cached) {
    return cached;
  }
  const loading = files(folder).catch(() => {
    lists.delete(folder);
    return [];
  });
  lists.set(folder, loading);
  return loading;
};
