// The one header every workspace page uses: a title, one line saying what the
// page is for, and an optional action on the right.
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div style={{ minWidth: 0 }}>
        <h1 className="display" style={{ fontSize: 40, margin: 0, overflowWrap: "anywhere" }}>
          {title}
        </h1>
        {description && (
          <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.65, margin: "10px 0 0", maxWidth: 640 }}>
            {description}
          </p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </header>
  );
}
