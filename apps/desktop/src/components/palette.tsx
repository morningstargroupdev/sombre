import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

export interface Entry {
  id: string;
  label: string;
  hint?: string;
  shortcut?: string;
  icon?: ReactNode;
  group: "actions" | "chats";
  run: () => void;
}

interface Props {
  open: boolean;
  entries: Entry[];
  onClose: () => void;
}

export const Palette = ({ open, entries, onClose }: Props) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [lit, setLit] = useState(0);
  const words = query.toLowerCase().split(/\s+/u).filter(Boolean);
  const shown = useMemo(
    () =>
      entries
        .filter((entry) =>
          words.every((word) =>
            `${entry.label} ${entry.hint ?? ""}`.toLowerCase().includes(word)
          )
        )
        .slice(0, 40),
    [entries, words]
  );

  useEffect(() => {
    const element = dialog.current;
    if (open && element && !element.open) {
      element.showModal();
    } else if (!open && element?.open) {
      element.close();
    }
  }, [open]);

  const run = (entry: Entry | undefined) => {
    if (!entry) {
      return;
    }
    onClose();
    setQuery("");
    entry.run();
  };

  const groups: Entry["group"][] = ["actions", "chats"];

  return (
    <dialog
      aria-label="command palette"
      className="border-rim bg-raise text-body backdrop:bg-ink/60 m-auto mt-[12vh] w-[min(560px,90vw)] overflow-hidden rounded-2xl border p-0 shadow-[0_24px_80px_rgb(0_0_0/0.6)]"
      onClose={() => {
        setQuery("");
        onClose();
      }}
      ref={dialog}
    >
      <div className="border-rim flex items-center gap-2 border-b px-4">
        <svg
          aria-hidden="true"
          className="text-fog size-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.4"
          viewBox="0 0 16 16"
        >
          <circle cx="7" cy="7" r="4.5" />
          <path d="m10.5 10.5 3 3" />
        </svg>
        <input
          aria-label="search commands and chats"
          className="text-paper placeholder:text-fog h-12 min-w-0 flex-1 bg-transparent text-[14px] outline-none"
          onChange={(event) => {
            setQuery(event.target.value);
            setLit(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const step = event.key === "ArrowDown" ? 1 : -1;
              setLit(
                (current) =>
                  (current + step + shown.length) % Math.max(1, shown.length)
              );
            } else if (event.key === "Enter") {
              event.preventDefault();
              run(shown[lit]);
            }
          }}
          placeholder="search commands and chats"
          spellCheck={false}
          value={query}
        />
      </div>
      <div className="flex max-h-[min(440px,60vh)] flex-col overflow-y-auto overscroll-contain p-1.5">
        {shown.length === 0 ? (
          <p className="text-fog px-3 py-6 text-center">nothing matches</p>
        ) : null}
        {groups.map((group) => {
          const inside = shown.filter((entry) => entry.group === group);
          if (inside.length === 0) {
            return null;
          }
          return (
            <section className="flex flex-col" key={group}>
              <p className="text-fog px-2.5 pt-2 pb-1 text-[11px]">{group}</p>
              {inside.map((entry) => {
                const index = shown.indexOf(entry);
                return (
                  <button
                    className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left ${index === lit ? "bg-well text-paper" : "hover:bg-well"}`}
                    key={entry.id}
                    onClick={() => run(entry)}
                    onMouseEnter={() => setLit(index)}
                    tabIndex={-1}
                    type="button"
                  >
                    <span
                      aria-hidden="true"
                      className="text-fog flex w-4 shrink-0 justify-center"
                    >
                      {entry.icon}
                    </span>
                    <span className="min-w-0 truncate text-[13px]">
                      {entry.label}
                    </span>
                    {entry.hint ? (
                      <span className="text-fog min-w-0 truncate text-[12px]">
                        {entry.hint}
                      </span>
                    ) : null}
                    {entry.shortcut ? (
                      <kbd className="text-fog ml-auto shrink-0 text-[11px]">
                        {entry.shortcut}
                      </kbd>
                    ) : null}
                  </button>
                );
              })}
            </section>
          );
        })}
      </div>
    </dialog>
  );
};
