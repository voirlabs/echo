"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { EXTENSION_URL } from "@/lib/site";

const LINKS = [
  { label: "Drafts", href: "/drafts" },
  { label: "Profile", href: "/profile" },
  { label: "Connect assistant", href: "/connect" },
];

export function AppNav({ signOutAction }: { signOutAction: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Escape closes the drawer on small screens.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="mobile-header">
        <Link href="/drafts" aria-label="Echo, your drafts" className="logo-link">
          <Logo size={24} />
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="app-sidebar"
          className="btn ghost small menu-btn"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}

      <aside id="app-sidebar" className={`sidebar${open ? " open" : ""}`}>
        <Link href="/drafts" aria-label="Echo, your drafts" className="logo-link sidebar-logo">
          <Logo />
        </Link>
        <nav aria-label="Main" className="sidebar-nav">
          {LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`nav-link${active ? " active" : ""}`}
              >
                {l.label}
              </Link>
            );
          })}
          {EXTENSION_URL && (
            <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer" className="nav-link">
              Chrome extension ↗
            </a>
          )}
        </nav>

        <form action={signOutAction} className="sidebar-foot">
          <button type="submit" className="text-btn">Sign out</button>
        </form>
      </aside>
    </>
  );
}
