import type { Chat } from "../lib/api";
import { names } from "../lib/api";
import { mac, shortcut } from "../lib/platform";
import { Panel } from "./header";
import { Logo } from "./logo";
import { Mark } from "./mark";

interface Props {
  recent: Chat[];
  hidden: boolean;
  onSidebar: () => void;
  onPick: (chat: Chat) => void;
  onCreate: () => void;
  onPalette: () => void;
  onSettings: () => void;
}

const action =
  "border-rim text-body hover:border-fog hover:text-paper active:bg-well flex h-8 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[12.5px]";

export const Start = ({
  recent,
  hidden,
  onSidebar,
  onPick,
  onCreate,
  onPalette,
  onSettings,
}: Props) => (
  <main className="flex min-h-0 flex-col">
    <div
      className={`flex h-13 shrink-0 items-center ${hidden && mac ? "pl-[88px]" : "pl-3"}`}
      data-tauri-drag-region="deep"
    >
      {hidden ? (
        <button
          aria-label="show the sidebar"
          className="text-fog hover:bg-raise hover:text-paper active:bg-well flex size-7 cursor-pointer items-center justify-center rounded-lg"
          onClick={onSidebar}
          type="button"
        >
          <Panel />
        </button>
      ) : null}
    </div>
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-6 pb-13">
      <div className="flex flex-col items-center gap-1 text-center">
        <Mark className="text-ember mb-4 h-6 w-10" />
        <p className="text-paper font-semibold">
          {recent.length > 0 ? "pick up where you left off" : "pick a chat"}
        </p>
        <p className="text-fog">
          claude code, codex, and sombre chats all show up here
        </p>
      </div>
      {recent.length > 0 ? (
        <ul className="border-rim bg-raise/40 flex w-full max-w-[520px] flex-col rounded-xl border p-1">
          {recent.map((chat) => (
            <li key={`${chat.agent}:${chat.id}`}>
              <button
                className="hover:bg-well focus-visible:bg-well active:bg-rim flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left"
                onClick={() => onPick(chat)}
                type="button"
              >
                <Logo agent={chat.agent} />
                <span className="sr-only">{names[chat.agent]}</span>
                <span className="text-paper min-w-0 flex-1 truncate text-[13px]">
                  {chat.title}
                </span>
                <span className="text-fog shrink-0 text-[12px]">
                  {`${chat.project} · ${chat.ago}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap justify-center gap-2">
        <button className={action} onClick={onCreate} type="button">
          new chat
          <kbd className="text-fog text-[11px]">{shortcut("n")}</kbd>
        </button>
        <button className={action} onClick={onPalette} type="button">
          palette
          <kbd className="text-fog text-[11px]">{shortcut("k")}</kbd>
        </button>
        <button className={action} onClick={onSettings} type="button">
          settings
          <kbd className="text-fog text-[11px]">{shortcut(",")}</kbd>
        </button>
      </div>
    </div>
  </main>
);
