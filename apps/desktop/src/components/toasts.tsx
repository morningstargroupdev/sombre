import { useEffect, useState } from "react";

import type { Toast } from "../lib/toasts";
import { dismiss, useToasts } from "../lib/toasts";
import { chip } from "./popover";

const LIFE = 6000;

const Item = ({ item }: { item: Toast }) => {
  const [present, setPresent] = useState(() => document.hasFocus());

  useEffect(() => {
    const back = () => setPresent(true);
    const gone = () => setPresent(false);
    window.addEventListener("focus", back);
    window.addEventListener("blur", gone);
    return () => {
      window.removeEventListener("focus", back);
      window.removeEventListener("blur", gone);
    };
  }, []);

  useEffect(() => {
    if (!present) {
      return;
    }
    const timer = window.setTimeout(() => dismiss(item.id), LIFE);
    return () => window.clearTimeout(timer);
  }, [present, item.id]);

  return (
    <li className="border-rim bg-raise animate-pop pointer-events-auto flex w-[340px] items-start gap-3 rounded-xl border px-3.5 py-3 shadow-[0_12px_40px_rgb(0_0_0/0.5)] motion-reduce:animate-none">
      <span aria-hidden="true" className="text-ember pt-0.5 text-[10px]">
        ●
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-paper text-[13px]">{item.title}</p>
        {item.body ? (
          <p
            className={`text-fog text-[12px] ${item.wrap ? "line-clamp-4 [overflow-wrap:anywhere]" : "truncate"}`}
          >
            {item.body}
          </p>
        ) : null}
      </div>
      {item.action ? (
        <button
          className={`${chip} border-rim -my-1 border`}
          onClick={() => {
            item.action?.run();
            dismiss(item.id);
          }}
          type="button"
        >
          {item.action.label}
        </button>
      ) : null}
      <button
        aria-label="dismiss"
        className={`${chip} -my-1 -mr-1.5 px-1.5`}
        onClick={() => dismiss(item.id)}
        type="button"
      >
        ✕
      </button>
    </li>
  );
};

export const Toasts = () => {
  const shown = useToasts();
  return (
    <ol
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-40 flex flex-col items-end gap-2"
    >
      {shown.map((item) => (
        <Item item={item} key={item.id} />
      ))}
    </ol>
  );
};
