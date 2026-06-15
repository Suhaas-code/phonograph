import { useAuth } from "../auth/AuthContext";
import { AuthShell } from "./LoginPage";

export default function PendingApprovalPage() {
  const { user, logout, refresh } = useAuth();

  const rejected = user?.approval_status === "rejected";

  return (
    <AuthShell title={rejected ? "Access denied" : "Awaiting approval"}>
      <p className="text-sm text-gray-300">
        {rejected
          ? "Your account request was not approved. Contact the administrator if you believe this is a mistake."
          : "Your account has been created and is waiting for an administrator to approve it. You'll gain access to libraries and collections once approved."}
      </p>
      <div className="mt-4 flex gap-2">
        {!rejected && (
          <button className="btn-ghost flex-1" onClick={() => refresh()}>
            Check again
          </button>
        )}
        <button className="btn-ghost flex-1" onClick={logout}>
          Sign out
        </button>
      </div>
    </AuthShell>
  );
}
