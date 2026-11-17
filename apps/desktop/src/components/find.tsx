import type { RefObject } from "react";
import { useEffect, useState } from "react";

import { clear, paint, ranges } from "../lib/find";
import { chip } from "./popover";

interface Props {
  root: RefObject<HTMLElement | null>;
  onClose: () => void;
}

export const Find = ({ root, onClose }: Props) => {
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState(0);
  const [found, setFound] = useState<Range[]>([]);
  const at = found.length === 0 ? 0 : current % found.length;
  const scan = (text: string) => {
    const next = root.current ? ranges(root.current, text) : [];
    setFound(next);
    return next;
  };

  useEffect(() => {
    paint(found, at);
    found[at]?.startContainer.parentElement?.scrollIntoView({
      block: "center",
    });
  }, [found, at]);

  useEffect(() => clear, []);

  const step = (by: number) => {
    const next = scan(query);
    setCurrent((value) =>
      next.length === 0 ? 0 : (value + by + next.length) % next.length
    );
  };

  let count = "";
  if (query !== "") {
    count = found.length === 0 ? "no matches" : `${at + 1} of ${found.length}`;
  }

  return (
    <div className="border-rim bg-raise animate-pop absolute top-3 right-6 z-20 flex items-center gap-1 rounded-xl border py-1 pr-1 pl-3 shadow-[0_12px_40px_rgb(0_0_0/0.5)] motion-reduce:animate-none">
      <input
        aria-label="find in this chat"
        className="text-paper placeholder:text-fog h-7 w-52 bg-transparent text-[13px] outline-none"
        onChange={(event) => {
          setQuery(event.target.value);
          setCurrent(0);
          scan(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            step(event.shiftKey ? -1 : 1);
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
        }}
        placeholder="find in this chat"
        ref={(node) => node?.focus()}
        spellCheck={false}
        value={query}
      />
      <span
        className={`min-w-[9ch] text-right text-[12px] ${found.length === 0 && query !== "" ? "text-paper" : "text-fog"}`}
      >
        {count}
      </span>
      <button
        aria-label="previous match"
        className={chip}
        disabled={found.length === 0}
        onClick={() => step(-1)}
        type="button"
      >
        ↑
      </button>
      <button
        aria-label="next match"
        className={chip}
        disabled={found.length === 0}
        onClick={() => step(1)}
        type="button"
      >
        ↓
      </button>
      <button
        aria-label="close find"
        className={chip}
        onClick={onClose}
        type="button"
      >
        ✕
      </button>
    </div>
  );
};
