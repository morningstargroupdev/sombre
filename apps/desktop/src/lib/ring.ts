export const RADIUS = 5;

export const ring = (left: number) => {
  const around = 2 * Math.PI * RADIUS;
  const used = Math.min(100, Math.max(0, 100 - left));
  return {
    dash: `${Math.round((used / 100) * around * 100) / 100} ${Math.round(around * 100) / 100}`,
    low: left < 20,
  };
};
