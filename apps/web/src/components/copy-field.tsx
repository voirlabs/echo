"use client";

import { useState } from "react";

/** A Copy button for `value`, with a fallback message when the clipboard is blocked. */
export function CopyButton({ value, label = "Copy", className = "btn" }: { value: string; label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  function copy() {
    navigator.clipboard
      .writeText(value)
      .then(() => setState("copied"))
      .catch(() => setState("failed"))
      .finally(() => setTimeout(() => setState("idle"), 2500));
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        className={className}
      >
        {state === "copied" ? "Copied" : state === "failed" ? "Select and copy" : label}
      </button>
      <span aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
        {state === "copied" ? "Copied to clipboard" : state === "failed" ? "Copy failed. Select the text and copy it yourself." : ""}
      </span>
    </>
  );
}

/** A read-only one-line field with a Copy button, for values like the MCP address. */
export function CopyField({
  value,
  label,
}: {
  value: string;
  /** Accessible name for the field, e.g. "Echo server address". */
  label: string;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "stretch", flexWrap: "wrap" }}>
      <input
        readOnly
        value={value}
        aria-label={label}
        onFocus={(e) => e.currentTarget.select()}
        className="input"
        style={{ flex: 1, minWidth: 200, fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text)" }}
      />
      <CopyButton value={value} />
    </div>
  );
}
