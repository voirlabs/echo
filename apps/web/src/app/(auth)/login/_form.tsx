"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { APP_NAME } from "@/lib/site";
import { ArrowRight, Eye, EyeOff } from "@/components/icons";

export function LoginForm({ next, setupProblem }: { next: string; setupProblem: string | null }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    if (res?.ok) {
      router.push(next);
      router.refresh();
      return;
    }
    setLoading(false);
    if (!res) return setError("Couldn't reach the server. Check your connection and try again.");
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setError(data.error ?? (res.status === 429 ? "Too many attempts. Wait a few minutes and try again." : "Sign-in failed. Try again."));
  }

  return (
    <div className="auth-card">
      <div className="card">
        <h1 className="display auth-title">Sign <em>in</em></h1>
        <p className="auth-lead">
          {setupProblem ? `${APP_NAME} isn't set up yet.` : "Sign in with this deployment's admin password."}
        </p>

        {setupProblem ? (
          <div role="alert" className="msg error">{setupProblem}</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="pw-wrap">
                <input
                  id="password"
                  className="input"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "password-error" : undefined}
                  required
                  autoFocus
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Hide password" : "Show password"}
                  aria-pressed={show}
                >
                  {show ? <EyeOff /> : <Eye />}
                </button>
              </div>
              {error && <p id="password-error" role="alert" className="field-error">{error}</p>}
            </div>

            <button type="submit" className="btn auth-submit" disabled={loading || !password}>
              {loading ? "Signing in…" : <>Sign in <ArrowRight /></>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
