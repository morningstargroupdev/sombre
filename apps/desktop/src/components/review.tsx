import { useEffect, useMemo, useRef, useState } from "react";

import { changes, failure } from "../lib/api";
import type { File, Line, Scope } from "../lib/patch";
import { parse, split, totals } from "../lib/patch";
import { mac } from "../lib/platform";
import { useWidth } from "../lib/width";
import { Count } from "./count";
import { chip } from "./popover";

type Loaded =
  | { state: "loading" }
  | { state: "failed"; message: string }
  | { state: "ready"; files: File[]; cut: boolean };

const BIG = 600;

const tones: Record<Line["kind"], string> = {
  add: "bg-ember/[0.07] text-paper",
  gone: "bg-well text-fog",
  same: "text-body",
};

const signs: Record<Line["kind"], string> = {
  add: "+",
  gone: "−",
  same: " ",
};

const labels: Record<File["status"], string> = {
  added: "new",
  deleted: "deleted",
  modified: "",
  renamed: "renamed",
};

const Lines = ({ file }: { file: File }) => (
  <div className="text-[12px] leading-[1.6]">
    {file.hunks.map((hunk) => (
      <div key={hunk.header}>
        <p className="bg-raise/60 text-fog truncate px-3 py-0.5 select-none">
          {hunk.header}
        </p>
        {hunk.lines.map((line) => (
          <div
            className={`grid grid-cols-[4ch_4ch_2ch_minmax(0,1fr)] ${tones[line.kind]}`}
            key={`${line.old ?? ""}:${line.now ?? ""}:${line.kind}`}
          >
            <span className="text-fog/60 pr-1 text-right select-none">
              {line.old ?? ""}
            </span>
            <span className="text-fog/60 pr-1 text-right select-none">
              {line.now ?? ""}
            </span>
            <span
              aria-hidden="true"
              className={`text-center select-none ${line.kind === "add" ? "text-ember" : "text-fog"}`}
            >
              {signs[line.kind]}
            </span>
            <span className="pr-3 [overflow-wrap:anywhere] whitespace-pre-wrap">
              {line.text}
            </span>
          </div>
        ))}
      </div>
    ))}
  </div>
);

interface SectionProps {
  file: File;
  onOpen: (path: string) => void;
}

const Section = ({ file, onOpen }: SectionProps) => {
  const size = file.added + file.removed;
  const [folded, setFolded] = useState(size > BIG);
  const { folder, name } = split(file.path);
  const label =
    file.status === "renamed" && file.from
      ? `from ${file.from}`
      : labels[file.status];
  return (
    <section className="border-rim border-b" data-file={file.path}>
      <div className="bg-ink/95 border-rim sticky top-0 z-10 flex items-center gap-1 border-b pr-2 backdrop-blur">
        <button
          aria-expanded={!folded}
          className="hover:bg-raise/60 flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-2 pl-3 text-left text-[12.5px]"
          onClick={() => setFolded((current) => !current)}
          type="button"
        >
          <span aria-hidden="true" className="text-fog w-2.5 text-[9px]">
            {folded ? "▸" : "▾"}
          </span>
          <span className="min-w-0 truncate">
            <span className="text-fog">{folder}</span>
            <span className="text-paper">{name}</span>
          </span>
          {label ? <span className="text-fog shrink-0">{label}</span> : null}
          <Count
            added={file.binary ? null : file.added}
            className="ml-auto"
            removed={file.binary ? null : file.removed}
          />
        </button>
        {file.status === "deleted" ? null : (
          <button
            aria-label={`open ${file.path}`}
            className={chip}
            onClick={() => onOpen(file.path)}
            title="open in your editor"
            type="button"
          >
            open
          </button>
        )}
      </div>
      {folded && size > BIG ? (
        <button
          className="text-fog hover:text-body w-full cursor-pointer px-3 py-2 text-left text-[12.5px]"
          onClick={() => setFolded(false)}
          type="button"
        >
          {`a big change, ${size} lines. show it`}
        </button>
      ) : null}
      {!folded && file.binary ? (
        <p className="text-fog px-3 py-2 text-[12.5px]">
          a binary file, so there is nothing to show line by line
        </p>
      ) : null}
      {folded || file.binary ? null : <Lines file={file} />}
    </section>
  );
};

interface Props {
  folder: string;
  scope: Scope;
  latest: Scope | null;
  focus: string | null;
  version: number;
  hidden: boolean;
  overlay: boolean;
  onScope: (scope: Scope) => void;
  onOpen: (path: string) => void;
  onClose: () => void;
}

const Body = ({
  loaded,
  scope,
  onOpen,
}: {
  loaded: Loaded;
  scope: Scope;
  onOpen: (path: string) => void;
}) => {
  if (loaded.state === "loading") {
    return (
      <p className="text-fog animate-late px-4 py-6">reading the changes</p>
    );
  }
  if (loaded.state === "failed") {
    return <p className="text-fog px-4 py-6">{loaded.message}</p>;
  }
  if (loaded.files.length === 0) {
    return (
      <div className="text-fog flex flex-col gap-1 px-4 py-6">
        <p className="text-paper">no changes</p>
        <p>
          {scope.kind === "all"
            ? "nothing differs from the last commit"
            : "this turn didn't change any files"}
        </p>
      </div>
    );
  }
  return (
    <>
      {loaded.cut ? (
        <p className="text-fog border-rim border-b px-4 py-2 text-[12.5px]">
          the diff is too big to show in full, so the last files are left out
        </p>
      ) : null}
      {loaded.files.map((file) => (
        <Section file={file} key={file.path} onOpen={onOpen} />
      ))}
    </>
  );
};

export const Review = ({
  folder,
  scope,
  latest,
  focus,
  version,
  hidden,
  overlay,
  onScope,
  onOpen,
  onClose,
}: Props) => {
  const [width, pane] = useWidth<HTMLElement>();
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [round, setRound] = useState(0);
  const body = useRef<HTMLDivElement>(null);
  const from = scope.kind === "turn" ? scope.from : null;
  const to = scope.kind === "turn" ? scope.to : null;

  const asked = useMemo(
    () => ({ folder, from, round, to, version }),
    [folder, from, to, version, round]
  );

  useEffect(() => {
    let alive = true;
    const read = async () => {
      try {
        const diff = await changes(asked.folder, asked.from, asked.to);
        if (alive) {
          setLoaded({ cut: diff.cut, files: parse(diff.text), state: "ready" });
        }
      } catch (error) {
        if (alive) {
          setLoaded({ message: failure(error), state: "failed" });
        }
      }
    };
    read();
    return () => {
      alive = false;
    };
  }, [asked]);

  const ready = loaded.state === "ready";
  useEffect(() => {
    if (!(ready && focus)) {
      return;
    }
    const found = [
      ...(body.current?.querySelectorAll<HTMLElement>("[data-file]") ?? []),
    ].find((node) => node.dataset.file === focus);
    found?.scrollIntoView({ block: "start" });
  }, [ready, focus]);

  const sum = ready ? totals(loaded.files) : null;
  const turn = scope.kind === "turn" ? scope : latest;

  return (
    <aside
      aria-label="changes"
      className={`border-rim bg-ink flex min-h-0 flex-col ${overlay ? "absolute inset-y-0 right-0 z-20 w-full" : "w-[min(50%,760px)] min-w-[380px] shrink-0 border-l"}`}
      ref={pane}
    >
      <header
        className={`border-rim flex h-13 shrink-0 items-center gap-2 border-b ${mac ? "pr-2" : "pr-36"} ${overlay && hidden && mac ? "pl-[88px]" : "pl-4"}`}
        data-tauri-drag-region="deep"
      >
        <h2
          className={width >= 440 ? "text-paper mr-1 font-semibold" : "sr-only"}
        >
          changes
        </h2>
        <div className="border-rim flex shrink-0 items-center rounded-lg border p-0.5 whitespace-nowrap">
          <button
            aria-pressed={scope.kind === "turn"}
            className={`${chip} aria-pressed:bg-well aria-pressed:text-paper h-6`}
            disabled={turn === null}
            onClick={() => turn && onScope(turn)}
            type="button"
          >
            {scope.kind === "turn" ? "this turn" : "last turn"}
          </button>
          <button
            aria-pressed={scope.kind === "all"}
            className={`${chip} aria-pressed:bg-well aria-pressed:text-paper h-6`}
            onClick={() => onScope({ kind: "all" })}
            type="button"
          >
            uncommitted
          </button>
        </div>
        {sum && loaded.state === "ready" && loaded.files.length > 0 ? (
          <span className="text-fog flex min-w-0 items-center gap-2 text-[12px] whitespace-nowrap">
            {width >= 500 ? (
              <span>
                {loaded.files.length === 1
                  ? "1 file"
                  : `${loaded.files.length} files`}
              </span>
            ) : null}
            <Count added={sum.added} removed={sum.removed} />
          </span>
        ) : null}
        <span className="ml-auto flex shrink-0 items-center">
          <button
            aria-label="refresh the changes"
            className={chip}
            onClick={() => setRound((current) => current + 1)}
            title="refresh"
            type="button"
          >
            ↻
          </button>
          <button
            aria-label="close the changes"
            className={chip}
            onClick={onClose}
            title="close"
            type="button"
          >
            ✕
          </button>
        </span>
      </header>
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain select-text"
        ref={body}
      >
        <Body loaded={loaded} onOpen={onOpen} scope={scope} />
      </div>
    </aside>
  );
};
