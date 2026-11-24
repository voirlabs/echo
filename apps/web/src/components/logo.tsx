import { APP_NAME } from "@/lib/site";

/** The Echo lockup: the mark, then the lowercase name at 0.8× the mark, spaced 0.4×. */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <span className="lockup" style={{ gap: Math.round(size * 0.4), fontSize: Math.round(size * 0.8) }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size SVG */}
      <img src="/logo.svg" alt="" width={size} height={size} />
      {APP_NAME.toLowerCase()}
    </span>
  );
}

/** The small "by Voir Labs" endorsement, linking to the studio. */
export function ByVoirLabs() {
  return (
    <a className="endorse" href="https://www.voirlabs.io/" target="_blank" rel="noopener">
      by Voir Labs
    </a>
  );
}
