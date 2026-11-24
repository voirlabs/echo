import Link from "next/link";

// Empty or no-results state, the same on every page, with an optional next step.
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="card empty-state">
      <h2 className="display">{title}</h2>
      {children && <p>{children}</p>}
      {action && (
        <Link href={action.href} className="btn small">
          {action.label}
        </Link>
      )}
    </div>
  );
}
