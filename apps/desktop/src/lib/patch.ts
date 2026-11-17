export type Scope =
  | { kind: "turn"; from: string; to: string }
  | { kind: "all" };

export type Kind = "add" | "gone" | "same";

export interface Line {
  kind: Kind;
  text: string;
  old: number | null;
  now: number | null;
}

export interface Hunk {
  header: string;
  lines: Line[];
}

export type Status = "added" | "deleted" | "renamed" | "modified";

export interface File {
  path: string;
  from: string | null;
  status: Status;
  added: number;
  removed: number;
  binary: boolean;
  hunks: Hunk[];
}

const unquote = (text: string) =>
  text.startsWith('"') && text.endsWith('"')
    ? text.slice(1, -1).replaceAll('\\"', '"').replaceAll("\\\\", "\\")
    : text;

const side = (text: string) => {
  const path = unquote(text.trim());
  if (path === "/dev/null") {
    return null;
  }
  return path.replace(/^[ab]\//u, "");
};

const fallback = (header: string) => {
  const rest = header.slice("diff --git ".length);
  const split = rest.lastIndexOf(" b/");
  return split === -1 ? rest : rest.slice(split + 3);
};

const HUNK = /^@@ -(?<old>\d+)(?:,\d+)? \+(?<now>\d+)(?:,\d+)? @@/u;

const blank = (header: string): File => ({
  added: 0,
  binary: false,
  from: null,
  hunks: [],
  path: fallback(header),
  removed: 0,
  status: "modified",
});

const meta = (file: File, line: string) => {
  if (line.startsWith("new file mode")) {
    file.status = "added";
  } else if (line.startsWith("deleted file mode")) {
    file.status = "deleted";
  } else if (line.startsWith("rename from ")) {
    file.status = "renamed";
    file.from = line.slice("rename from ".length);
  } else if (line.startsWith("rename to ")) {
    file.path = line.slice("rename to ".length);
  } else if (line.startsWith("Binary files ")) {
    file.binary = true;
  } else if (line.startsWith("+++ ")) {
    file.path = side(line.slice(4)) ?? file.path;
  } else if (line.startsWith("--- ") && file.status === "deleted") {
    file.path = side(line.slice(4)) ?? file.path;
  }
};

export const parse = (text: string): File[] => {
  const files: File[] = [];
  let file: File | null = null;
  let hunk: Hunk | null = null;
  let old = 0;
  let now = 0;
  for (const line of text.split("\n")) {
    if (line.startsWith("diff --git ")) {
      file = blank(line);
      files.push(file);
      hunk = null;
      continue;
    }
    if (!file) {
      continue;
    }
    const opened = HUNK.exec(line);
    if (opened?.groups) {
      hunk = { header: line, lines: [] };
      file.hunks.push(hunk);
      old = Number(opened.groups.old);
      now = Number(opened.groups.now);
      continue;
    }
    if (!hunk) {
      meta(file, line);
      continue;
    }
    if (line.startsWith("+")) {
      hunk.lines.push({ kind: "add", now, old: null, text: line.slice(1) });
      now += 1;
      file.added += 1;
    } else if (line.startsWith("-")) {
      hunk.lines.push({ kind: "gone", now: null, old, text: line.slice(1) });
      old += 1;
      file.removed += 1;
    } else if (line.startsWith(" ")) {
      hunk.lines.push({ kind: "same", now, old, text: line.slice(1) });
      old += 1;
      now += 1;
    }
  }
  return files;
};

export const totals = (files: File[]) => ({
  added: files.reduce((sum, file) => sum + file.added, 0),
  removed: files.reduce((sum, file) => sum + file.removed, 0),
});

export const split = (path: string) => {
  const at = path.lastIndexOf("/");
  return at === -1
    ? { folder: "", name: path }
    : { folder: path.slice(0, at + 1), name: path.slice(at + 1) };
};
