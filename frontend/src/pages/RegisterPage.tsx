import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useConfig } from "../api/hooks";
import { useAuth } from "../auth/AuthContext";
import { ErrorText } from "../components/ui";
import { AuthShell } from "./LoginPage";

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { data: config } = useConfig();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/auth/register", {
        method: "POST",
        auth: false,
        body: { username, email, password },
      });
      // Auto sign-in after registration.
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

  return (
    <AuthShell title="Create an account" config={config}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label">Username</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="mt-1 text-xs text-gray-500">At least 8 characters.</p>
        </div>
        <ErrorText error={error} />
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="mt-3 text-center text-xs text-gray-500">
        New accounts require admin approval before accessing content.
      </p>
      <p className="mt-3 text-center text-sm text-gray-400">
        Have an account?{" "}
        <Link to="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
