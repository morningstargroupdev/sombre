export type Span =
  | { kind: "text"; key: number; text: string }
  | { kind: "code"; key: number; text: string }
  | { kind: "strong"; key: number; text: string }
  | { kind: "em"; key: number; text: string }
  | { kind: "link"; key: number; text: string; href: string }
  | { kind: "break"; key: number }
  | { kind: "rule"; key: number };

export interface Row {
  key: number;
  spans: Span[];
}

export type Block =
  | { kind: "paragraph"; key: number; spans: Span[] }
  | { kind: "heading"; key: number; major: boolean; spans: Span[] }
  | { kind: "rule"; key: number }
  | { kind: "quote"; key: number; spans: Span[] }
  | { kind: "code"; key: number; language: string; text: string }
  | { kind: "list"; key: number; ordered: boolean; items: Row[] }
  | { kind: "table"; key: number; rows: { key: number; cells: Row[] }[] };

const INLINE =
  /`(?<code>[^`]+)`|\*\*(?<strong>[^*]+)\*\*|\*(?<em>[^*\s][^*]*)\*|\[(?<label>[^\]]+)\]\((?<href>https?:\/\/[^\s)]+)\)/gu;
const ITEM = /^\s*(?:[-*+]|\d+[.)])\s+/u;
const HEADING = /^(?<marks>#{1,6})\s+(?<title>.*)$/u;
const RULE = /^(?:-{3,}|\*{3,}|_{3,})\s*$/u;
const DIVIDER = /^[\s|:-]+$/u;
const BOX = /[─━═]{3,}/gu;

const opens = (row: string) =>
  row.startsWith("```") ||
  HEADING.test(row) ||
  RULE.test(row) ||
  row.startsWith(">") ||
  row.trimStart().startsWith("|") ||
  ITEM.test(row);

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\|/u, "")
    .replace(/\|$/u, "")
    .split("|")
    .map((cell) => cell.trim());

export const markdown = (source: string): Block[] => {
  let counter = 0;
  const key = () => {
    counter += 1;
    return counter;
  };

  const inline = (text: string): Span[] => {
    const spans: Span[] = [];
    let last = 0;
    for (const match of text.matchAll(INLINE)) {
      if (match.index > last) {
        spans.push({
          key: key(),
          kind: "text",
          text: text.slice(last, match.index),
        });
      }
      const groups = match.groups ?? {};
      const plain = groups.code?.replaceAll(BOX, "").trim();
      if (plain === "") {
        spans.push({ key: key(), kind: "rule" });
      } else if (plain !== undefined) {
        spans.push({ key: key(), kind: "code", text: plain });
      } else if (groups.strong !== undefined) {
        spans.push({ key: key(), kind: "strong", text: groups.strong });
      } else if (groups.em !== undefined) {
        spans.push({ key: key(), kind: "em", text: groups.em });
      } else if (groups.label !== undefined && groups.href !== undefined) {
        spans.push({
          href: groups.href,
          key: key(),
          kind: "link",
          text: groups.label,
        });
      }
      last = match.index + match[0].length;
    }
    if (last < text.length) {
      spans.push({ key: key(), kind: "text", text: text.slice(last) });
    }
    return spans;
  };

  const gap = (): Span => ({ key: key(), kind: "break" });

  const joined = (rows: string[]) =>
    rows.flatMap((row, index) =>
      index === 0 ? inline(row) : [gap(), ...inline(row)]
    );

  const rows = source.replaceAll("\r\n", "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;
  const take = (keep: (row: string) => boolean) => {
    const kept: string[] = [];
    let row = rows[index];
    while (row !== undefined && keep(row)) {
      kept.push(row);
      index += 1;
      row = rows[index];
    }
    return kept;
  };

  while (index < rows.length) {
    const row = rows[index] ?? "";
    const heading = HEADING.exec(row);
    if (!row.trim()) {
      index += 1;
    } else if (row.startsWith("```")) {
      index += 1;
      const body = take((next) => !next.startsWith("```"));
      index += 1;
      blocks.push({
        key: key(),
        kind: "code",
        language: row.slice(3).trim(),
        text: body.join("\n"),
      });
    } else if (heading?.groups) {
      blocks.push({
        key: key(),
        kind: "heading",
        major: (heading.groups.marks ?? "").length <= 2,
        spans: inline(heading.groups.title ?? ""),
      });
      index += 1;
    } else if (RULE.test(row)) {
      blocks.push({ key: key(), kind: "rule" });
      index += 1;
    } else if (row.startsWith(">")) {
      const quote = take((next) => next.startsWith(">")).map((next) =>
        next.replace(/^>\s?/u, "")
      );
      blocks.push({ key: key(), kind: "quote", spans: joined(quote) });
    } else if (row.trimStart().startsWith("|")) {
      const table = take((next) => next.trimStart().startsWith("|")).filter(
        (next) => !DIVIDER.test(next)
      );
      blocks.push({
        key: key(),
        kind: "table",
        rows: table.map((next) => ({
          cells: cells(next).map((cell) => ({
            key: key(),
            spans: inline(cell),
          })),
          key: key(),
        })),
      });
    } else if (ITEM.test(row)) {
      const listed = take(
        (next) =>
          ITEM.test(next) || (next.startsWith("  ") && next.trim() !== "")
      );
      const items: Row[] = [];
      for (const next of listed) {
        const current = items.at(-1);
        if (ITEM.test(next) || !current) {
          items.push({ key: key(), spans: inline(next.replace(ITEM, "")) });
        } else {
          current.spans.push(
            { key: key(), kind: "text", text: " " },
            ...inline(next.trim())
          );
        }
      }
      blocks.push({
        items,
        key: key(),
        kind: "list",
        ordered: /^\s*\d/u.test(row),
      });
    } else {
      index += 1;
      const rest = take((next) => next.trim() !== "" && !opens(next));
      blocks.push({
        key: key(),
        kind: "paragraph",
        spans: joined([row, ...rest]),
      });
    }
  }
  return blocks;
};
