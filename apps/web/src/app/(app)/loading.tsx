export default function Loading() {
  return (
    <div className="page-pad" aria-busy="true" aria-live="polite">
      <p style={{ fontSize: 14, color: "var(--faint)" }}>Loading…</p>
    </div>
  );
}
