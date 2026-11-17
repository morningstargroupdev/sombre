import { split } from "./patch";

const name = (path: string) => split(path).name;

export const suggest = (files: string[]) => {
  const [first, second] = files;
  if (first === undefined) {
    return "";
  }
  if (second === undefined) {
    return `update ${name(first)}`;
  }
  if (files.length === 2) {
    return `update ${name(first)} and ${name(second)}`;
  }
  return `update ${name(first)} and ${files.length - 1} more files`;
};

export const counted = (count: number, one: string, many: string) =>
  count === 1 ? `1 ${one}` : `${count} ${many}`;
