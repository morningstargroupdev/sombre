import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";

import { restart, shell } from "../lib/terms";
import { chip } from "./popover";

const SHORTEST = 140;
const START = 280;

interface Props {
  chatKey: string;
  folder: string;
  place: string;
  onClose: () => void;
}

export const Drawer = ({ chatKey, folder, place, onClose }: Props) => {
  const box = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(START);

  useEffect(() => {
    const element = box.current;
    if (!element) {
      return;
    }
    const found = shell(chatKey, folder);
    element.append(found.box);
    const fit = () => found.fit.fit();
    fit();
    found.term.focus();
    const watcher = new ResizeObserver(fit);
    watcher.observe(element);
    return () => {
      watcher.disconnect();
      found.box.remove();
    };
  }, [chatKey, folder]);

  const drag = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = event.clientY;
    const from = height;
    const most = window.innerHeight * 0.7;
    const move = (next: PointerEvent) =>
      setHeight(
        Math.min(most, Math.max(SHORTEST, from + start - next.clientY))
      );
    const done = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", done);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", done);
  };

  return (
    <section
      aria-label="terminal"
      className="border-rim bg-ink relative flex shrink-0 flex-col border-t"
      style={{ height }}
    >
      <div
        aria-hidden="true"
        className="hover:bg-edge absolute -top-1 right-0 left-0 h-2 cursor-row-resize"
        onPointerDown={drag}
      />
      <header className="flex h-8 shrink-0 items-center gap-2 pr-2 pl-4 text-[12px]">
        <span className="text-paper">terminal</span>
        <span className="text-fog truncate">{place}</span>
        <span className="ml-auto flex items-center">
          <button
            aria-label="restart the shell"
            className={chip}
            onClick={() => {
              restart(chatKey, folder);
            }}
            title="restart"
            type="button"
          >
            ↻
          </button>
          <button
            aria-label="hide the terminal"
            className={chip}
            onClick={onClose}
            title="hide (the shell keeps running)"
            type="button"
          >
            ✕
          </button>
        </span>
      </header>
      <div className="min-h-0 flex-1 px-3 pb-2" ref={box} />
    </section>
  );
};
