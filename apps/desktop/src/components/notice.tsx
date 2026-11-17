import type { ReactNode } from "react";

interface Props {
  title: string;
  children?: ReactNode;
  late?: boolean;
  onRetry?: () => void;
}

export const Notice = ({ title, children, late, onRetry }: Props) => (
  <div
    className={`text-fog flex flex-col items-center gap-1 px-6 py-16 text-center motion-reduce:animate-none ${late ? "animate-late" : "animate-appear"}`}
    role={onRetry ? "alert" : "status"}
  >
    <p className="text-paper font-semibold">{title}</p>
    {children}
    {onRetry ? (
      <button
        className="border-rim text-body hover:border-fog hover:text-paper active:bg-well mt-3 cursor-pointer rounded-md border px-3 py-1 disabled:cursor-default disabled:opacity-50"
        onClick={onRetry}
        type="button"
      >
        try again
      </button>
    ) : null}
  </div>
);
