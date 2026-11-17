import { getCurrentWindow } from "@tauri-apps/api/window";

const current = getCurrentWindow();

const buttons = [
  { act: () => current.minimize(), label: "minimize", path: "M3 8h10" },
  {
    act: () => current.toggleMaximize(),
    label: "maximize",
    path: "M3.5 3.5h9v9h-9z",
  },
  { act: () => current.close(), label: "close", path: "M4 4l8 8M12 4l-8 8" },
];

export const Controls = () => (
  <div className="fixed top-0 right-0 z-30 flex h-13 items-center">
    {buttons.map((button) => (
      <button
        aria-label={button.label}
        className={`text-fog hover:text-paper flex h-full w-11 cursor-pointer items-center justify-center active:opacity-80 ${button.label === "close" ? "hover:bg-ember hover:text-ink" : "hover:bg-raise"}`}
        key={button.label}
        onClick={() => button.act()}
        type="button"
      >
        <svg
          aria-hidden="true"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          viewBox="0 0 16 16"
        >
          <path d={button.path} />
        </svg>
      </button>
    ))}
  </div>
);
