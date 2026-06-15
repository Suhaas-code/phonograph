import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useConfig } from "../api/hooks";
import { useAuth } from "../auth/AuthContext";
import { ErrorText } from "../components/ui";
import type { PublicConfig } from "../types";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { data: config } = useConfig();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const form = new URLSearchParams({ username, password });
      const { access_token } = await api<{ access_token: string }>("/auth/login", {
        method: "POST",
        form,
        auth: false,
      });
      await login(access_token);
      navigate("/");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function googleLogin() {
    try {
      const { authorization_url } = await api<{ authorization_url: string }>(
        "/auth/oauth/google/url",
        { auth: false }
      );
      window.location.href = authorization_url;
    } catch (err) {
      setError(err);
    }
  }

  return (
    <AuthShell title="Sign in to Phonograph" config={config}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label">Username</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <ErrorText error={error} />
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      {config?.google_oauth_enabled && (
        <button className="btn-ghost mt-3 w-full" onClick={googleLogin}>
          Continue with Google
        </button>
      )}
      <p className="mt-4 text-center text-sm text-gray-400">
        No account?{" "}
        <Link to="/register" className="text-accent hover:underline">
          Register
        </Link>
      </p>
    </AuthShell>
  );
}

export function AuthShell({
  title,
  children,
  config,
}: {
  title: string;
  children: React.ReactNode;
  config?: PublicConfig;
}) {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-2xl font-semibold text-white">Phonograph</div>
          <div className="text-sm text-gray-500">metadata-first music library</div>
        </div>
        <div className="card">
          <h1 className="mb-4 text-lg font-medium text-white">{title}</h1>
          {children}
        </div>
        {config && (
          <p className="mt-4 text-center text-xs text-gray-600">
            Supports {config.supported_formats.join(", ")} · audio never leaves your device
          </p>
        )}
      </div>
    </div>
  );
}
