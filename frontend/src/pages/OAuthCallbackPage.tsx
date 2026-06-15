import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { AuthShell } from "./LoginPage";
import { ErrorText } from "../components/ui";

export default function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState<unknown>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const code = params.get("code");
    if (!code) {
      setError(new Error("Missing authorization code"));
      return;
    }
    (async () => {
      try {
        const { access_token } = await api<{ access_token: string }>(
          "/auth/oauth/google/callback",
          { method: "POST", auth: false, body: { code } }
        );
        await login(access_token);
        navigate("/");
      } catch (err) {
        setError(err);
      }
    })();
  }, [params, login, navigate]);

  return (
    <AuthShell title="Completing sign-in…">
      {error ? <ErrorText error={error} /> : <p className="text-sm text-gray-400">Please wait…</p>}
    </AuthShell>
  );
}
