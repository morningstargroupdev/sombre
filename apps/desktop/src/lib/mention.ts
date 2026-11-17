const TOKEN = /(?:^|\s)@(?<query>[^\s@]*)$/u;

export const token = (text: string, caret: number) => {
  const match = TOKEN.exec(text.slice(0, caret));
  if (!match?.groups) {
    return null;
  }
  const query = match.groups.query ?? "";
  return { query, start: caret - query.length - 1 };
};

export const insert = (
  text: string,
  caret: number,
  start: number,
  path: string
) => {
  const head = text.slice(0, start);
  const tail = text.slice(caret).replace(/^\S*/u, "");
  const piece = `@${path} `;
  return {
    caret: head.length + piece.length,
    text: `${head}${piece}${tail.replace(/^ /u, "")}`,
  };
};
