import type { KeyboardEvent } from "react";
import { useEffect, useState } from "react";

import { known } from "../lib/files";
import type { Hit } from "../lib/fuzzy";
import { rank } from "../lib/fuzzy";
import { insert, token } from "../lib/mention";
import { split } from "../lib/patch";

const SHOWN = 30;

const Name = ({ hit }: { hit: Hit }) => {
  const { folder } = split(hit.path);
  const marked = new Set(hit.marks);
  const tone = (index: number) => {
    if (marked.has(index)) {
      return "text-ember";
    }
    return index < folder.length ? "text-fog" : "text-paper";
  };
  return (
    <span className="min-w-0 truncate">
      {[...hit.path].map((char, index) => (
        <span className={tone(index)} key={`${hit.path}:${index}`}>
          {char}
        </span>
      ))}
    </span>
  );
};

interface Menu {
  hits: Hit[];
  lit: number;
  loading: boolean;
  onChoose: (index: number) => void;
  onLight: (index: number) => void;
}

export const Mention = ({ hits, lit, loading, onChoose, onLight }: Menu) => (
  <div className="border-rim bg-raise absolute right-0 bottom-full left-0 z-20 mb-2 flex max-h-72 flex-col overflow-y-auto overscroll-contain rounded-xl border p-1 text-[13px] shadow-[0_12px_40px_rgb(0_0_0/0.5)]">
    {loading ? <p className="text-fog px-2.5 py-1.5">searching files</p> : null}
    {!loading && hits.length === 0 ? (
      <p className="text-fog px-2.5 py-1.5">no files match</p>
    ) : null}
    {hits.map((hit, index) => (
      <button
        className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left ${index === lit ? "bg-well" : "hover:bg-well"}`}
        key={hit.path}
        onClick={() => onChoose(index)}
        onMouseEnter={() => onLight(index)}
        tabIndex={-1}
        type="button"
      >
        <span aria-hidden="true" className="text-fog text-[11px]">
          @
        </span>
        <Name hit={hit} />
      </button>
    ))}
  </div>
);

interface Options {
  folder: { path: string } | null;
  fallback: string | null;
  text: string;
  caret: number;
  onText: (text: string, caret: number) => void;
}

export const useMention = ({
  folder: picked,
  fallback,
  text,
  caret,
  onText,
}: Options) => {
  const folder = picked?.path ?? fallback;
  const [paths, setPaths] = useState<{ folder: string; list: string[] } | null>(
    null
  );
  const [lit, setLit] = useState(0);
  const [closed, setClosed] = useState<number | null>(null);
  const found = folder ? token(text, caret) : null;
  const wanted = found !== null;

  useEffect(() => {
    if (!(wanted && folder)) {
      return;
    }
    let alive = true;
    const load = async () => {
      const list = await known(folder);
      if (alive) {
        setPaths({ folder, list });
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [wanted, folder]);

  const ready = paths !== null && paths.folder === folder;
  const hits = found && ready ? rank(found.query, paths.list, SHOWN) : [];
  const shown = found !== null && closed !== found.start;
  const at = Math.min(lit, Math.max(0, hits.length - 1));

  const choose = (index: number) => {
    const hit = hits[index];
    if (!(hit && found)) {
      return;
    }
    const next = insert(text, caret, found.start, hit.path);
    setLit(0);
    onText(next.text, next.caret);
  };

  const keys = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(shown && found)) {
      return false;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setClosed(found.start);
      return true;
    }
    if (hits.length === 0) {
      return false;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setLit((at + step + hits.length) % hits.length);
      return true;
    }
    if (event.key === "Tab" || event.key === "Enter") {
      event.preventDefault();
      choose(at);
      return true;
    }
    return false;
  };

  return {
    keys,
    menu: shown ? (
      <Mention
        hits={hits}
        lit={at}
        loading={!ready}
        onChoose={choose}
        onLight={setLit}
      />
    ) : null,
    reset: () => setLit(0),
  };
};
