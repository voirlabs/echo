"use client";

import { useEffect } from "react";

// Shown in place of a workspace page that failed to load; the sidebar stays.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page-pad">
      <div className="card error-card" role="alert">
        <h1 className="display">Something <em>went wrong</em></h1>
        <p>This page couldn&apos;t load. It&apos;s usually temporary, so try again.</p>
        <button type="button" className="btn" onClick={() => reset()}>Try again</button>
      </div>
    </div>
  );
}
