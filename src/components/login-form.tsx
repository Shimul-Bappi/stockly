"use client";

import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useState, type FormEvent } from "react";

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password }),
      });
      const result: { ok?: boolean; error?: string } = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Unable to sign in.");
      window.location.replace("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in.");
      setBusy(false);
    }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label className="field-label" htmlFor="workspace-password">Workspace password</label>
      <div className="login-password-field">
        <LockKeyhole size={18} aria-hidden="true" />
        <input id="workspace-password" type={visible ? "text" : "password"} autoComplete="current-password"
          value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required autoFocus />
        <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Hide password" : "Show password"}>
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {error && <p className="login-error" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary login-submit" disabled={busy || !password}>
        {busy ? "Signing in…" : "Sign in to workspace"}<ArrowRight size={17} />
      </button>
    </form>
  );
}
