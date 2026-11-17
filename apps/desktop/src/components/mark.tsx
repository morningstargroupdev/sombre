interface Props {
  className?: string;
}

export const Mark = ({ className }: Props) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox="4 7.8 24 15"
  >
    <path
      d="M10.37 18.25L5.17 15.25M12.75 15.87L9.75 10.67M16 15L16 9M19.25 15.87L22.25 10.67M21.63 18.25L26.83 15.25M5.5 21.5H26.5"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.8"
    />
  </svg>
);
