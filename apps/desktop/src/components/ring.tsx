import { RADIUS, ring } from "../lib/ring";

interface Props {
  left: number;
}

export const Ring = ({ left }: Props) => {
  const { dash, low } = ring(left);
  return (
    <span
      className="text-fog flex items-center gap-1 text-[11.5px]"
      title={`${left}% of the context window left`}
    >
      <svg
        aria-hidden="true"
        className="size-3 -rotate-90"
        fill="none"
        viewBox="0 0 12 12"
      >
        <circle
          className="stroke-rim"
          cx="6"
          cy="6"
          r={RADIUS}
          strokeWidth="1.6"
        />
        <circle
          className={low ? "stroke-ember" : "stroke-fog"}
          cx="6"
          cy="6"
          r={RADIUS}
          strokeDasharray={dash}
          strokeLinecap="round"
          strokeWidth="1.6"
        />
      </svg>
      <span className="sr-only">{`${left}% context left`}</span>
    </span>
  );
};
