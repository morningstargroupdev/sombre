import { useEffect, useState } from "react";

interface Props {
  text: string;
  className?: string;
}

export const Copy = ({ text, className = "" }: Props) => {
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!done) {
      return;
    }
    const timer = window.setTimeout(() => setDone(false), 1500);
    return () => window.clearTimeout(timer);
  }, [done]);

  return (
    <button
      aria-label={done ? "copied" : "copy"}
      className={`text-fog hover:bg-well hover:text-paper active:bg-rim cursor-pointer rounded-md px-1.5 py-0.5 text-[11.5px] ${className}`}
      onClick={() => {
        navigator.clipboard.writeText(text);
        setDone(true);
      }}
      type="button"
    >
      {done ? "copied" : "copy"}
    </button>
  );
};
