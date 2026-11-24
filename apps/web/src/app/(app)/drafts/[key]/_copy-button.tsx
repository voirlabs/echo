"use client";

import { useState } from "react";

/** Copies the draft, for anywhere the extension can't fill it in. */
export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const copied = state === "copied";

  function copy() {
    navigator.clipboard
      .writeText(text)
      .then(() => setState("copied"))
      .catch(() => setState("failed"))
      .finally(() => setTimeout(() => setState("idle"), 2500));
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-live="polite"
      className="btn ghost small"
      style={copied ? { color: "var(--success)", borderColor: "var(--success)" } : undefined}
    >
      {copied ? "Copied" : state === "failed" ? "Copy failed: select the text" : "Copy"}
    </button>
  );
}
