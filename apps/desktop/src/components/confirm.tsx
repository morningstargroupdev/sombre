import type { ReactNode } from "react";

import { secondary } from "./field";
import { Sheet } from "./sheet";

interface Props {
  open: boolean;
  title: string;
  action: string;
  busy: boolean;
  problem: string | null;
  children: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}

export const Confirm = ({
  open,
  title,
  action,
  busy,
  problem,
  children,
  onConfirm,
  onClose,
}: Props) => (
  <Sheet busy={busy} onClose={onClose} open={open} title={title}>
    <div className="text-fog mt-2 flex flex-col gap-2 text-[12.5px]">
      {children}
    </div>
    {problem ? (
      <p className="text-paper mt-3 text-[12.5px]" role="alert">
        {problem}
      </p>
    ) : null}
    <div className="mt-5 flex justify-end gap-2">
      <button
        className={secondary}
        disabled={busy}
        onClick={onClose}
        type="button"
      >
        cancel
      </button>
      <button
        className="bg-ember text-ink hover:bg-ember/90 active:bg-ember/80 h-8 cursor-pointer rounded-lg px-3 text-[12.5px] font-semibold disabled:cursor-default disabled:opacity-50"
        disabled={busy}
        onClick={onConfirm}
        type="button"
      >
        {busy ? "deleting" : action}
      </button>
    </div>
  </Sheet>
);
