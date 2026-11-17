import { useState } from "react";

import type { Chat } from "../lib/api";
import { failure, purge } from "../lib/api";
import { Confirm } from "./confirm";

interface Props {
  target: { folder: string; name: string } | null;
  chats: Chat[];
  onDone: (folder: string, gone: Chat[]) => void;
  onClose: () => void;
}

export const Wipe = ({ target, chats, onDone, onClose }: Props) => {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const condemned = target
    ? chats.filter((chat) => chat.folder === target.folder)
    : [];
  const count = condemned.length === 1 ? "1 chat" : `${condemned.length} chats`;
  const name = target?.name ?? "this folder";

  const run = async () => {
    if (!target) {
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await purge(target.folder);
      setBusy(false);
      onDone(target.folder, condemned);
    } catch (error) {
      setBusy(false);
      setProblem(failure(error));
    }
  };

  return (
    <Confirm
      action={`delete ${count}`}
      busy={busy}
      onClose={() => {
        if (!busy) {
          setProblem(null);
          onClose();
        }
      }}
      onConfirm={() => {
        run();
      }}
      open={target !== null}
      problem={problem}
      title={`delete every chat in ${name}?`}
    >
      <p>{`${count} from claude code, codex, and sombre go for good, archived ones too. this can't be undone.`}</p>
      <p>{`your files in ${name} stay as they are.`}</p>
    </Confirm>
  );
};
