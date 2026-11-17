export const STEP = 0.1;

export const scale = (level: number) =>
  Math.round(Math.min(1.6, Math.max(0.8, level)) * 10) / 10;

export const lack = <T extends { agent: string; version: string | null }>(
  installed: T[] | null,
  agent: string
) =>
  installed?.find((entry) => entry.agent === agent && entry.version === null) ??
  null;
