const paths = {
  arrow: "M4 12h16m-6-6 6 6-6 6",
  calendar: "M5 5h14v15H5zM8 3v4m8-4v4M5 10h14M8 14h2m4 0h2m-8 3h2",
  room: "M4 21h16M6 21V3h12v18M9 7h2m2 0h2m-6 4h2m2 0h2m-4 10v-6h2v6",
  book: "M12 6v15M12 6C8 3 4 4 3 5v14c3-1 6-1 9 2 3-3 6-3 9-2V5c-3-2-6-2-9 1Z",
  people:
    "M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 9v-3c0-3 12-3 12 0v3m2-17a4 4 0 0 1 0 8m1 3c3 0 5 1 5 3v3",
  check: "m5 12 4 4L19 6",
  exam: "M8 4H5v17h14V4h-3M8 3h8v4H8zM8 12h8m-8 4h5",
  screen: "M3 4h18v13H3zM8 21h8m-4-4v4",
  clock: "M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "m6 6 12 12M18 6 6 18",
  chevron: "m8 5 7 7-7 7",
  mail: "M3 5h18v14H3zM3 5l9 7 9-7",
  spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z",
};
export type IconName = keyof typeof paths;
export function Icon({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      className={`icon ${className}`}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
export function Logo() {
  return (
    <span className="brand">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <g transform="rotate(-5 14 14)">
          <rect x="2.5" y="2.5" width="10" height="10" rx="2" fill="#214b76" />
          <rect x="15.5" y="2.5" width="10" height="10" rx="2" fill="#80a9c5" />
          <rect x="2.5" y="15.5" width="10" height="10" rx="2" fill="#81b5a2" />
          <rect
            x="15.5"
            y="15.5"
            width="10"
            height="10"
            rx="2"
            fill="#c7d9e6"
          />
        </g>
      </svg>
      <span>
        campuszeit<span className="brand-dot">.</span>
      </span>
    </span>
  );
}
