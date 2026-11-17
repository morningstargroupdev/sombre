export const money = (cost: number | null) => {
  if (cost === null || cost <= 0) {
    return "";
  }
  return cost < 0.01 ? "<$0.01" : `$${cost.toFixed(2)}`;
};

export const clip = (text: string, shown: number) => {
  const lines = text.replace(/\n+$/u, "").split("\n");
  return {
    hidden: Math.max(0, lines.length - shown),
    lines: lines.slice(0, shown),
  };
};

export type Tone = "add" | "gone" | "same";

const tone = (line: string): Tone => {
  if (line.startsWith("+")) {
    return "add";
  }
  if (line.startsWith("-")) {
    return "gone";
  }
  return "same";
};

export const diff = (lines: string[]) =>
  lines.map((text, key) => ({ key, text, tone: tone(text) }));

export const encode = (bytes: Uint8Array) => {
  let text = "";
  for (let start = 0; start < bytes.length; start += 0x80_00) {
    text += String.fromCodePoint(...bytes.subarray(start, start + 0x80_00));
  }
  return btoa(text);
};

export const pictures = (paths: string[]) =>
  paths.filter((path) => /\.(?:png|jpe?g|gif|webp)$/iu.test(path));
