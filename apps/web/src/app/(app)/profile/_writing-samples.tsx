"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Sample {
  id: number;
  /** Optional user-given headline; null/absent falls back to the first-line preview. */
  label?: string | null;
  text: string;
}

/**
 * The user's own writing, kept as samples. Their style is measured from these, two of
 * them ride along with every draft as examples, and the assistant builds the style
 * guide from them. The assistant adds them (or the user, from a saved draft's page);
 * here they can only be removed. Removing one resets the guide, which the assistant
 * then rebuilds.
 */
export function WritingSamples({ initialSamples, guide }: {
  initialSamples: Sample[];
  guide: { built: boolean; tasksWaiting: number };
}) {
  const [samples, setSamples] = useState<Sample[]>(initialSamples);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  async function remove(id: number) {
    if (!confirm("Remove this sample? Your style guide is rebuilt from the samples that remain.")) return;
    setStatus(null);
    try {
      const res = await fetch("/api/user/style-samples", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) return setStatus({ ok: false, text: "Couldn't remove that sample. Try again." });
      setSamples((s) => s.filter((x) => x.id !== id));
      router.refresh();
    } catch {
      setStatus({ ok: false, text: "Couldn't reach the server. Try again." });
    }
  }

  const guideText =
    guide.tasksWaiting > 0
      ? `${guide.built ? "Needs an update" : "Not built yet"}. Your assistant updates it the next time it writes for you (${guide.tasksWaiting} short task${guide.tasksWaiting === 1 ? "" : "s"}).`
      : guide.built
        ? "Up to date"
        : "Built once your assistant has saved a sample.";

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 className="section-title">Writing samples</h2>
        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: 0, maxWidth: 600 }}>
          Things you wrote, saved by your assistant when you share them or tell it what you actually sent. Drafts are
          checked against how these read, so they sound like you.
        </p>
        <p style={{ fontSize: 13, color: "var(--faint)", lineHeight: 1.6, margin: "8px 0 0", maxWidth: 600 }}>
          <span style={{ color: guide.tasksWaiting > 0 ? "var(--warning)" : guide.built ? "var(--success)" : "var(--text)" }}>
            Style guide:
          </span>{" "}
          {guideText}
        </p>
      </div>

      {samples.length > 0 && (
        <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {samples.map((s, i) => (
            <SampleTile key={s.id} index={i + 1} sample={s} onRemove={remove} />
          ))}
        </ol>
      )}

      {samples.length === 0 && (
        <p className="profile-empty">
          None yet. Paste something you wrote into a chat with your assistant and ask it to save it as a writing sample.
        </p>
      )}
      {status && (
        <p role={status.ok ? "status" : "alert"} style={{ margin: "10px 0 0", fontSize: 13, color: status.ok ? "var(--success)" : "var(--danger)" }}>
          {status.text}
        </p>
      )}
    </div>
  );
}

/** Fallback label when a sample has no user-given headline: skip a bare markdown
 *  heading like "# Job Title" in favour of the first real content line. */
function previewLine(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.find((l) => !/^#{1,6}\s/.test(l)) ?? lines[0] ?? "";
}

/**
 * One writing sample, collapsed to a single numbered line by default so a full
 * set stays compact. Shows the user's headline if they gave one, else the
 * first-line fallback. Click the row to expand the whole text (scrolls if long);
 * Remove stays on the right and doesn't toggle.
 */
function SampleTile({ sample, index, onRemove }: { sample: Sample; index: number; onRemove: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const preview = sample.label?.trim() || previewLine(sample.text);
  return (
    <li style={{ padding: "6px 0", borderTop: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="entry-toggle"
          style={{ alignItems: "center", minHeight: 36 }}
        >
          <span aria-hidden="true" style={{ fontSize: 11, color: "var(--faint)", flexShrink: 0, width: 10 }}>{open ? "▾" : "▸"}</span>
          <span style={{ fontSize: 12, color: "var(--faint)", flexShrink: 0 }}>{index}.</span>
          <span className="ellipsis" style={{ fontSize: 14, color: "var(--text)", minWidth: 0 }}>{preview || "Writing sample"}</span>
        </button>
        <button type="button" onClick={() => onRemove(sample.id)} aria-label={`Remove sample ${index}`} className="text-btn danger" style={{ flexShrink: 0 }}>
          Remove
        </button>
      </div>
      {open && (
        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: "6px 0 8px 20px", whiteSpace: "pre-wrap", maxHeight: 280, overflowY: "auto" }}>
          {sample.text}
        </p>
      )}
    </li>
  );
}
