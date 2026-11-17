import { useState } from "react";

import type { Entry } from "../lib/api";
import { summary } from "../lib/feed";
import { Step } from "./step";

const FOLD = 4;
const TAIL = 3;

interface Props {
  steps: (Entry & { kind: "step" })[];
  live: boolean;
}

export const Work = ({ steps, live }: Props) => {
  const [open, setOpen] = useState(false);
  if (steps.length <= FOLD) {
    return (
      <div className="flex flex-col gap-0.5 pl-[2ch]">
        {steps.map((step) => (
          <Step key={step.id} step={step} />
        ))}
      </div>
    );
  }
  const earlier = live && !open ? steps.slice(0, -TAIL) : steps;
  let shown: typeof steps = [];
  if (open) {
    shown = steps;
  } else if (live) {
    shown = steps.slice(-TAIL);
  }
  return (
    <div className="flex flex-col gap-0.5 pl-[2ch]">
      <button
        aria-expanded={open}
        className="text-fog hover:text-body active:text-paper flex cursor-pointer items-center gap-x-[1ch] rounded-sm text-left"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span
          aria-hidden="true"
          className="flex w-[1ch] shrink-0 justify-center text-[10px]"
        >
          {open ? "▾" : "▸"}
        </span>
        <span className="truncate">{summary(earlier)}</span>
      </button>
      {shown.map((step) => (
        <Step key={step.id} step={step} />
      ))}
    </div>
  );
};
