import type { Command } from "../lib/commands";

interface Props {
  offered: Command[];
  lit: number;
  onChoose: (index: number) => void;
  onLight: (index: number) => void;
}

export const Slash = ({ offered, lit, onChoose, onLight }: Props) => (
  <div className="border-rim bg-raise absolute right-0 bottom-full left-0 z-20 mb-2 flex max-h-72 flex-col overflow-y-auto overscroll-contain rounded-xl border p-1 shadow-[0_12px_40px_rgb(0_0_0/0.5)]">
    {offered.map((command, index) => (
      <button
        className={`flex w-full cursor-pointer items-baseline gap-3 rounded-lg px-2.5 py-1.5 text-left ${index === lit ? "bg-well" : "hover:bg-well"}`}
        key={command.name}
        onClick={() => onChoose(index)}
        onMouseEnter={() => onLight(index)}
        tabIndex={-1}
        type="button"
      >
        <span className="text-paper text-[13px]">{`/${command.name}`}</span>
        {command.takes ? (
          <span className="text-fog text-[12px]">{`<${command.takes}>`}</span>
        ) : null}
        <span className="text-fog ml-auto truncate text-[12px]">
          {command.about}
        </span>
      </button>
    ))}
  </div>
);
