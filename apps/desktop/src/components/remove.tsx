import { useState } from "react";

import { secondary } from "./field";
import { chip } from "./popover";

interface Props {
  label: string;
  confirm: string;
  onRemove: () => void;
}

export const Remove = ({ label, confirm, onRemove }: Props) => {
  const [sure, setSure] = useState(false);
  if (!sure) {
    return (
      <button className={secondary} onClick={() => setSure(true)} type="button">
        {label}
      </button>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-1">
      <button className={chip} onClick={() => setSure(false)} type="button">
        cancel
      </button>
      <button
        className={`${secondary} border-fog text-paper`}
        onClick={() => {
          setSure(false);
          onRemove();
        }}
        type="button"
      >
        {confirm}
      </button>
    </span>
  );
};
