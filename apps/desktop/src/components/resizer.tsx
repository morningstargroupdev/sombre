import type { PointerEvent } from "react";

import { WIDTH, widen } from "../lib/sidebar";

interface Props {
  width: number;
  onWidth: (width: number) => void;
}

export const Resizer = ({ width, onWidth }: Props) => {
  const drag = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const start = event.clientX;
    const move = (next: globalThis.PointerEvent) =>
      onWidth(widen(width + next.clientX - start));
    const done = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", done);
      document.body.style.cursor = "";
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", done);
  };

  return (
    <div
      aria-hidden="true"
      className="hover:bg-edge active:bg-ember/60 absolute top-0 -right-1 bottom-0 z-10 w-2 cursor-col-resize transition-colors"
      onDoubleClick={() => onWidth(WIDTH)}
      onPointerDown={drag}
      title="drag to resize, double click to reset"
    />
  );
};
