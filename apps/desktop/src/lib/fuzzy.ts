export interface Hit {
  path: string;
  score: number;
  marks: number[];
}

const starts = new Set(["/", "-", "_", ".", " "]);

const walk = (wanted: string, lower: string, from: number) => {
  const marks: number[] = [];
  let at = from;
  for (const char of wanted) {
    const found = lower.indexOf(char, at);
    if (found === -1) {
      return null;
    }
    marks.push(found);
    at = found + 1;
  }
  return marks;
};

const score = (wanted: string, path: string): Hit | null => {
  const lower = path.toLowerCase();
  const base = lower.lastIndexOf("/") + 1;
  const named = walk(wanted, lower, base);
  const marks = named ?? walk(wanted, lower, 0);
  if (!marks) {
    return null;
  }
  let total = named ? 10 : 0;
  for (const [index, mark] of marks.entries()) {
    if (index > 0 && marks[index - 1] === mark - 1) {
      total += 4;
    }
    if (mark === 0 || starts.has(lower[mark - 1] ?? "")) {
      total += 3;
    }
  }
  const name = lower.slice(base);
  if (name.startsWith(wanted)) {
    total += 20;
  } else if (name.includes(wanted)) {
    total += 8;
  }
  return { marks, path, score: total - path.length / 100 };
};

export const rank = (query: string, paths: string[], limit = 40): Hit[] => {
  const wanted = query.toLowerCase();
  if (wanted === "") {
    return paths.slice(0, limit).map((path) => ({ marks: [], path, score: 0 }));
  }
  const hits: Hit[] = [];
  for (const path of paths) {
    const hit = score(wanted, path);
    if (hit) {
      hits.push(hit);
    }
  }
  hits.sort((one, two) => two.score - one.score);
  return hits.slice(0, limit);
};
