import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  title: string;
  busy: boolean;
  children: ReactNode;
  onClose: () => void;
}

export const Sheet = ({ open, title, busy, children, onClose }: Props) => {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (open && element && !element.open) {
      element.showModal();
    } else if (!open && element?.open) {
      element.close();
    }
  }, [open]);

  return (
    <dialog
      aria-label={title}
      className="border-rim bg-raise text-body backdrop:bg-ink/60 m-auto w-[min(460px,90vw)] rounded-2xl border p-5 shadow-[0_24px_80px_rgb(0_0_0/0.6)]"
      onCancel={(event) => {
        if (busy) {
          event.preventDefault();
        }
      }}
      onClose={onClose}
      ref={dialog}
    >
      <h2 className="text-paper text-[14px] font-semibold">{title}</h2>
      {children}
    </dialog>
  );
};
