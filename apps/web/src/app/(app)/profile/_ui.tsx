// Shared pieces of the Profile page's sections.

export function SectionHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 className="section-title">{title}</h2>
      {children && <p style={{ fontSize: 14, color: "var(--muted)", margin: 0, lineHeight: 1.6, maxWidth: 600 }}>{children}</p>}
    </div>
  );
}
