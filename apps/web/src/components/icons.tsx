// The few line icons the app uses, drawn like lucide's (24px grid, 2px stroke).
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const ArrowRight = ({ size = 16 }: { size?: number }) => (
  <svg {...base} width={size} height={size}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const ArrowLeft = ({ size = 16 }: { size?: number }) => (
  <svg {...base} width={size} height={size}><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
);
export const Eye = ({ size = 20 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
export const EyeOff = ({ size = 20 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <path d="M10.7 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2M6.6 6.6C3.6 8.6 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="m2 2 20 20" />
  </svg>
);
