import { useEffect, useRef } from "react";

import { chip } from "./popover";

export const primary =
  "bg-paper text-ink hover:bg-body active:bg-fog h-8 shrink-0 cursor-pointer rounded-lg px-3 text-[12.5px] font-semibold disabled:cursor-default disabled:opacity-40";

export const secondary = `${chip} border-rim h-8 border`;

interface Props {
  label: string;
  value: string;
  placeholder?: string;
  secret?: boolean;
  focus?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export const Field = ({
  label,
  value,
  placeholder,
  secret,
  focus,
  onChange,
  onSubmit,
  onCancel,
}: Props) => {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focus) {
      input.current?.focus();
    }
  }, [focus]);

  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-fog text-[11.5px]">{label}</span>
      <input
        autoComplete="off"
        className="border-rim bg-well text-paper placeholder:text-fog focus:border-fog h-8 rounded-md border px-2 text-[13px] outline-none"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          } else if (event.key === "Escape") {
            event.stopPropagation();
            onCancel();
          }
        }}
        placeholder={placeholder}
        ref={input}
        spellCheck={false}
        type={secret ? "password" : "text"}
        value={value}
      />
    </label>
  );
};
