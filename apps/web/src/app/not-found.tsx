import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@/components/icons";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="auth-shell status-page">
      <div className="auth-logo"><Logo size={34} /></div>
      <p className="label">404 · Not found</p>
      <h1 className="display">Page <em>not found</em></h1>
      <p className="status-lead">
        This page doesn&apos;t exist or has moved. A link to a draft stops working once the draft is deleted.
      </p>
      <Link href="/" className="btn status-action"><ArrowLeft /> Your drafts</Link>
    </main>
  );
}
