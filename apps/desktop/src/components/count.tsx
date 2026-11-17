interface Props {
  added: number | null;
  removed: number | null;
  className?: string;
}

export const Count = ({ added, removed, className = "" }: Props) => {
  if (added === null || removed === null) {
    return <span className={`text-fog ${className}`}>binary</span>;
  }
  return (
    <span className={`flex shrink-0 gap-[1ch] tabular-nums ${className}`}>
      <span className="text-ember">{`+${added}`}</span>
      <span className="text-fog">{`−${removed}`}</span>
    </span>
  );
};
