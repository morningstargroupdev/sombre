import type { Changed } from "../lib/api";
import { split } from "../lib/patch";
import { Count } from "./count";
import { chip } from "./popover";

const SHOWN = 6;

interface Props {
  files: Changed[];
  onOpen: (path: string | null) => void;
}

const sum = (files: Changed[], pick: (file: Changed) => number | null) =>
  files.reduce((total, file) => total + (pick(file) ?? 0), 0);

export const Edits = ({ files, onOpen }: Props) => {
  const shown = files.slice(0, SHOWN);
  const more = files.length - shown.length;
  return (
    <section className="border-rim bg-raise/40 ml-[2ch] overflow-hidden rounded-xl border text-[12.5px]">
      <header className="flex items-center gap-3 py-1.5 pr-1.5 pl-3">
        <span className="text-paper">
          {files.length === 1
            ? "1 file changed"
            : `${files.length} files changed`}
        </span>
        <Count
          added={sum(files, (file) => file.added)}
          removed={sum(files, (file) => file.removed)}
        />
        <button
          className={`${chip} ml-auto`}
          onClick={() => onOpen(null)}
          type="button"
        >
          review
        </button>
      </header>
      <ul className="border-rim border-t py-1">
        {shown.map((file) => {
          const { folder, name } = split(file.path);
          return (
            <li key={file.path}>
              <button
                className="hover:bg-well focus-visible:bg-well active:bg-rim flex w-full cursor-pointer items-center gap-3 px-3 py-1 text-left"
                onClick={() => onOpen(file.path)}
                title={file.path}
                type="button"
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-fog">{folder}</span>
                  <span className="text-body">{name}</span>
                </span>
                <Count added={file.added} removed={file.removed} />
              </button>
            </li>
          );
        })}
        {more > 0 ? (
          <li>
            <button
              className="text-fog hover:text-body hover:bg-well w-full cursor-pointer px-3 py-1 text-left"
              onClick={() => onOpen(null)}
              type="button"
            >
              {`${more} more in the review`}
            </button>
          </li>
        ) : null}
      </ul>
    </section>
  );
};
