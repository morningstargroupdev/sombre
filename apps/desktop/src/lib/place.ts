export interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Spot {
  top: number | null;
  bottom: number | null;
  left: number;
  height: number;
}

export const GAP = 6;
const EDGE = 8;
const TALLEST = 420;
const SHORTEST = 120;

export const fit = (
  box: Box,
  size: Size,
  view: Size,
  side: "top" | "bottom",
  align: "start" | "end",
  flip = true
): Spot => {
  const below = view.height - box.bottom - GAP - EDGE;
  const above = box.top - GAP - EDGE;
  const wanted = Math.min(size.height, TALLEST);
  const preferred = side === "bottom" ? below : above;
  const other = side === "bottom" ? above : below;
  const flipped = flip && preferred < wanted && other > preferred;
  const down = side === "bottom" ? !flipped : flipped;
  const room = Math.max(SHORTEST, down ? below : above);
  const start = align === "start" ? box.left : box.right - size.width;
  const widest = Math.max(EDGE, view.width - size.width - EDGE);
  return {
    bottom: down ? null : view.height - box.top + GAP,
    height: Math.min(TALLEST, room),
    left: Math.min(Math.max(EDGE, start), widest),
    top: down ? box.bottom + GAP : null,
  };
};
