import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Chat } from "../lib/api";
import { names } from "../lib/api";
import type { Flag } from "../lib/live";
import { marks } from "../lib/live";
import { mac, pressed, shortcut } from "../lib/platform";
import type { Prefs, Project } from "../lib/sidebar";
import { keyed, sections, short, toggle } from "../lib/sidebar";
import { keyOf, useMarks } from "../lib/store";
import { Logo } from "./logo";
import { Mark } from "./mark";
import { Notice } from "./notice";
import { Divider, Option, Popover } from "./popover";

export type Listing =
  | { state: "loading" }
  | { state: "failed"; message: string }
  | { state: "ready"; chats: Chat[] };

export interface Actions {
  open: (chat: Chat) => void;
  create: (folder?: string) => void;
  rename: (chat: Chat, name: string) => void;
  reveal: (folder: string) => void;
  copy: (text: string) => void;
  settings: () => void;
  retry: () => void;
  purge: (project: Project) => void;
}

interface Props {
  listing: Listing;
  current: string | null;
  prefs: Prefs;
  actions: Actions;
  onPrefs: (prefs: Prefs) => void;
}

const move = (event: KeyboardEvent<HTMLButtonElement>) => {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
    return;
  }
  const rows = [
    ...document.querySelectorAll<HTMLButtonElement>("button[data-chat]"),
  ];
  const at = rows.indexOf(event.currentTarget);
  const next =
    event.key === "ArrowDown"
      ? Math.min(at + 1, rows.length - 1)
      : Math.max(at - 1, 0);
  event.preventDefault();
  rows[next]?.focus();
};

const icon =
  "text-fog hover:bg-raise hover:text-paper active:bg-well flex cursor-pointer items-center justify-center rounded-lg";

interface RowProps {
  chat: Chat;
  current: boolean;
  mark: Flag | null;
  pinned: boolean;
  actions: Actions;
  onPin: () => void;
  onArchive: () => void;
}

const Menu = ({
  chat,
  pinned,
  actions,
  onPin,
  onArchive,
  onRename,
  close,
}: Omit<RowProps, "current" | "mark"> & {
  onRename: () => void;
  close: () => void;
}) => (
  <>
    <Option
      icon="◆"
      label={pinned ? "unpin" : "pin"}
      onPick={() => {
        onPin();
        close();
      }}
    />
    <Option
      icon="✎"
      label="rename"
      onPick={() => {
        close();
        onRename();
      }}
      shortcut="F2"
    />
    <Option
      icon="+"
      label="new chat in this folder"
      onPick={() => {
        close();
        actions.create(chat.folder);
      }}
    />
    <Divider />
    <Option
      icon="↗"
      label="show in finder"
      onPick={() => {
        close();
        actions.reveal(chat.folder);
      }}
    />
    <Option
      icon="⧉"
      label="copy resume command"
      onPick={() => {
        close();
        actions.copy(`sombre resume ${chat.id}`);
      }}
    />
    <Divider />
    <Option
      hint="restore it from settings"
      icon="↓"
      label="archive"
      onPick={() => {
        close();
        onArchive();
      }}
    />
  </>
);

const Status = ({ mark, ago }: { mark: Flag | null; ago: string }) => {
  if (mark === "busy") {
    return (
      <span className="text-ember" title="working">
        <span aria-hidden="true">●</span>
        <span className="sr-only">working</span>
      </span>
    );
  }
  if (mark === "ask") {
    return <span className="text-ember">needs you</span>;
  }
  if (mark === "failed") {
    return <span className="text-paper">failed</span>;
  }
  if (mark === "new") {
    return <span className="text-ember">new</span>;
  }
  return <span className="text-fog">{short(ago)}</span>;
};

const Row = (props: RowProps) => {
  const { chat, current, mark, actions } = props;
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [name, setName] = useState(chat.title);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      field.current?.select();
    }
  }, [editing]);

  const edit = () => {
    setName(chat.title);
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    if (name.trim() !== "" && name.trim() !== chat.title) {
      actions.rename(chat, name.trim());
    }
  };

  if (editing) {
    return (
      <input
        aria-label={`rename ${chat.title}`}
        className="border-edge bg-well text-paper h-8 w-full rounded-md border px-2 text-[13px] outline-none"
        onBlur={commit}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commit();
          } else if (event.key === "Escape") {
            setName(chat.title);
            setEditing(false);
          }
        }}
        ref={field}
        spellCheck={false}
        value={name}
      />
    );
  }

  return (
    <div className="group relative">
      <button
        aria-current={current ? "true" : undefined}
        className={`flex h-8 w-full cursor-pointer items-center gap-2 rounded-md pr-9 pl-2 text-left text-[13px] ${current ? "bg-well text-paper" : "text-body hover:bg-raise active:bg-well"}`}
        data-chat=""
        onClick={() => actions.open(chat)}
        onContextMenu={(event) => {
          event.preventDefault();
          setMenu(true);
        }}
        onDoubleClick={edit}
        onKeyDown={(event) => {
          if (event.key === "F2") {
            edit();
          } else {
            move(event);
          }
        }}
        type="button"
      >
        <span
          className={`flex w-3.5 shrink-0 justify-center ${current ? "" : "opacity-50 group-hover:opacity-100"}`}
        >
          <Logo agent={chat.agent} />
        </span>
        <span className="sr-only">{names[chat.agent]}</span>
        <span
          className={`min-w-0 flex-1 truncate ${mark === "new" || mark === "failed" ? "text-paper font-semibold" : ""}`}
        >
          {chat.title}
        </span>
      </button>
      <span className="pointer-events-none absolute top-0 right-2 flex h-8 items-center text-[11.5px] group-focus-within:opacity-0 group-hover:opacity-0">
        <Status ago={chat.ago} mark={mark} />
      </span>
      <span
        className={`absolute top-1 right-1 ${menu ? "opacity-100" : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"}`}
      >
        <Popover
          align="start"
          className={`${icon} aria-expanded:bg-well aria-expanded:text-paper size-6`}
          label={`actions for ${chat.title}`}
          onOpen={setMenu}
          open={menu}
          side="bottom"
          trigger={<span aria-hidden="true">···</span>}
          width="w-72"
        >
          {(close) => <Menu {...props} close={close} onRename={edit} />}
        </Popover>
      </span>
    </div>
  );
};

interface GroupProps {
  project: Project;
  folded: boolean;
  opened: boolean;
  children: ReactNode;
  onFold: () => void;
  onMore: () => void;
  onCreate: () => void;
  onReveal: () => void;
  onPurge: () => void;
}

const Group = ({
  project,
  folded,
  opened,
  children,
  onFold,
  onMore,
  onCreate,
  onReveal,
  onPurge,
}: GroupProps) => {
  const [menu, setMenu] = useState(false);
  return (
    <section className="flex flex-col gap-px">
      <div
        className="group flex h-7 items-center rounded-md pr-1"
        onContextMenu={(event) => {
          event.preventDefault();
          setMenu(true);
        }}
      >
        <button
          aria-expanded={!folded}
          className="text-fog hover:text-body flex h-7 min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-md px-2 text-left text-[12px]"
          onClick={onFold}
          title={project.place}
          type="button"
        >
          <span aria-hidden="true" className="w-2.5 text-[9px]">
            {folded ? "▸" : "▾"}
          </span>
          <span className="truncate">{project.name}</span>
        </button>
        <span
          className={
            menu
              ? "opacity-100"
              : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
          }
        >
          <Popover
            align="start"
            className={`${icon} aria-expanded:bg-well aria-expanded:text-paper size-6`}
            label={`actions for ${project.name}`}
            onOpen={setMenu}
            open={menu}
            side="bottom"
            trigger={<span aria-hidden="true">···</span>}
            width="w-72"
          >
            {(close) => (
              <>
                <Option
                  icon="+"
                  label="new chat here"
                  onPick={() => {
                    close();
                    onCreate();
                  }}
                />
                <Option
                  icon="↗"
                  label="show in finder"
                  onPick={() => {
                    close();
                    onReveal();
                  }}
                />
                <Divider />
                <Option
                  hint="every agent. asks first"
                  icon="✕"
                  label="delete all its chats"
                  onPick={() => {
                    close();
                    onPurge();
                  }}
                />
              </>
            )}
          </Popover>
        </span>
        <button
          aria-label={`new chat in ${project.name}`}
          className={`${icon} size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100`}
          onClick={onCreate}
          type="button"
        >
          +
        </button>
      </div>
      {folded ? null : (
        <>
          <ul className="flex flex-col gap-px">{children}</ul>
          {project.more > 0 || opened ? (
            <button
              className="text-fog hover:text-body cursor-pointer self-start rounded-md py-1 pr-2 pl-[1.85rem] text-[12px]"
              onClick={onMore}
              type="button"
            >
              {opened && project.more === 0
                ? "show less"
                : `show ${project.more} more`}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
};

const Pencil = () => (
  <svg
    aria-hidden="true"
    className="size-4"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.3"
    viewBox="0 0 16 16"
  >
    <path d="M8.5 2.5H4A1.5 1.5 0 0 0 2.5 4v8A1.5 1.5 0 0 0 4 13.5h8a1.5 1.5 0 0 0 1.5-1.5V7.5" />
    <path d="m11.5 2 2.5 2.5L8.5 10H6V7.5z" />
  </svg>
);

const Gear = () => (
  <svg
    aria-hidden="true"
    className="size-4"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeWidth="1.3"
    viewBox="0 0 16 16"
  >
    <circle cx="8" cy="8" r="2.2" />
    <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
  </svg>
);

export const Sidebar = ({
  listing,
  current,
  prefs,
  actions,
  onPrefs,
}: Props) => {
  const shown = useMarks();
  const status = useMemo(() => marks(shown), [shown]);
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const grouped = useMemo(
    () =>
      sections(
        listing.state === "ready" ? listing.chats : [],
        prefs,
        query,
        current
      ),
    [listing, prefs, query, current]
  );

  useEffect(() => {
    const keys = (event: globalThis.KeyboardEvent) => {
      if (pressed(event, "f", true)) {
        event.preventDefault();
        search.current?.focus();
        search.current?.select();
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, []);

  const row = (chat: Chat) => {
    const chatKey = keyOf(chat.agent, chat.id);
    const saved = keyed(chat);
    return (
      <li key={saved}>
        <Row
          actions={actions}
          chat={chat}
          current={chatKey === current}
          onArchive={() =>
            onPrefs({
              ...prefs,
              archived: toggle(prefs.archived, saved),
              pinned: prefs.pinned.filter((entry) => entry !== saved),
            })
          }
          onPin={() =>
            onPrefs({ ...prefs, pinned: toggle(prefs.pinned, saved) })
          }
          pinned={prefs.pinned.includes(saved)}
          mark={status.get(chatKey) ?? null}
        />
      </li>
    );
  };

  return (
    <aside className="bg-ink border-rim flex min-h-0 flex-col border-r">
      <header
        className={`flex h-13 shrink-0 items-center gap-2 pr-2 ${mac ? "pl-[88px]" : "pl-4"}`}
        data-tauri-drag-region="deep"
      >
        <Mark className="text-ember h-2.5 w-4" />
        <span className="text-paper flex-1 font-semibold">sombre</span>
        <button
          aria-label="new chat"
          className={`${icon} size-7`}
          onClick={() => actions.create()}
          title={`new chat ${shortcut("n")}`}
          type="button"
        >
          <Pencil />
        </button>
      </header>
      <div className="px-2 pb-2">
        <label className="border-rim focus-within:border-edge flex h-8 items-center gap-2 rounded-lg border px-2.5">
          <svg
            aria-hidden="true"
            className="text-fog size-3.5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.4"
            viewBox="0 0 16 16"
          >
            <circle cx="7" cy="7" r="4.5" />
            <path d="m10.5 10.5 3 3" />
          </svg>
          <span className="sr-only">search chats</span>
          <input
            className="text-paper placeholder:text-fog h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setQuery("");
              } else if (event.key === "ArrowDown") {
                event.preventDefault();
                document
                  .querySelector<HTMLButtonElement>("button[data-chat]")
                  ?.focus();
              }
            }}
            placeholder="search"
            ref={search}
            spellCheck={false}
            type="search"
            value={query}
          />
          <kbd className="text-fog text-[11px]">{shortcut("f", true)}</kbd>
        </label>
      </div>
      <nav
        aria-label="chats"
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2 pb-3"
      >
        {listing.state === "loading" ? (
          <Notice late title="reading your chats" />
        ) : null}
        {listing.state === "failed" ? (
          <Notice
            onRetry={() => actions.retry()}
            title="couldn't read your chats"
          >
            <p>{listing.message}</p>
          </Notice>
        ) : null}
        {listing.state === "ready" && grouped.total === 0 ? (
          <Notice title={query ? "nothing matches" : "no chats yet"}>
            <p>
              {query
                ? "try fewer words, or press esc"
                : "start one with the new chat button"}
            </p>
          </Notice>
        ) : null}
        {grouped.pinned.length > 0 ? (
          <section className="flex flex-col gap-px">
            <p className="text-fog flex h-7 items-center px-2 text-[12px]">
              pinned
            </p>
            <ul className="flex flex-col gap-px">{grouped.pinned.map(row)}</ul>
          </section>
        ) : null}
        {grouped.projects.map((project) => (
          <Group
            folded={prefs.folded.includes(project.folder) && query === ""}
            key={project.folder}
            onCreate={() => actions.create(project.folder)}
            onFold={() =>
              onPrefs({
                ...prefs,
                folded: toggle(prefs.folded, project.folder),
              })
            }
            onMore={() =>
              onPrefs({
                ...prefs,
                opened: toggle(prefs.opened, project.folder),
              })
            }
            onPurge={() => actions.purge(project)}
            onReveal={() => actions.reveal(project.folder)}
            opened={prefs.opened.includes(project.folder)}
            project={project}
          >
            {project.chats.map(row)}
          </Group>
        ))}
      </nav>
      <footer className="border-rim flex shrink-0 items-center gap-1 border-t p-2">
        <button
          className="text-fog hover:bg-raise hover:text-paper active:bg-well flex h-8 flex-1 cursor-pointer items-center gap-2 rounded-lg px-2 text-left text-[13px]"
          onClick={() => actions.settings()}
          type="button"
        >
          <Gear />
          <span className="flex-1">settings</span>
          <kbd className="text-[11px]">{shortcut(",")}</kbd>
        </button>
      </footer>
    </aside>
  );
};
