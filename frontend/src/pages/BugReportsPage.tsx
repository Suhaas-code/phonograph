import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useBugReports, useCreateBugReport } from "../api/hooks";
import { PageHeader, Spinner, Empty, ErrorText } from "../components/ui";
import { formatDate } from "../lib/format";
import type { BugStatus } from "../types";

function StatusBadge({ status }: { status: BugStatus }) {
  return (
    <span
      className={`badge ${
        status === "open"
          ? "border-emerald-500 text-emerald-300"
          : "border-gray-600 text-gray-400"
      }`}
    >
      {status}
    </span>
  );
}

export default function BugReportsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const navigate = useNavigate();
  const [filter, setFilter] = useState<BugStatus | "">("");
  const { data: reports, isLoading } = useBugReports(filter || undefined);
  const create = useCreateBugReport();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const report = await create.mutateAsync({ title, body });
    setTitle("");
    setBody("");
    setShowForm(false);
    navigate(`/bugs/${report.id}`);
  }

  return (
    <div>
      <PageHeader
        title="Report a Bug"
        subtitle={
          isAdmin
            ? "All bug reports across users. Join the conversation or close them."
            : "Report issues and chat with the team about them."
        }
        actions={
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "New report"}
          </button>
        }
      />

      {showForm && (
        <form onSubmit={onCreate} className="card mb-6 space-y-3">
          <div>
            <label className="label">Title</label>
            <input
              className="input"
              placeholder="Short summary of the problem"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
            />
          </div>
          <div>
            <label className="label">What happened?</label>
            <textarea
              className="input min-h-[90px]"
              placeholder="Describe the issue. You can add screenshots in the conversation after creating it."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <ErrorText error={create.error} />
          <button className="btn-primary" disabled={create.isPending || !title.trim()}>
            {create.isPending ? "Creating…" : "Create report"}
          </button>
        </form>
      )}

      <div className="mb-4 flex gap-2 text-sm">
        {(["", "open", "closed"] as const).map((s) => (
          <button
            key={s || "all"}
            onClick={() => setFilter(s)}
            className={`rounded px-3 py-1 ${
              filter === s ? "bg-accent text-ink" : "border border-edge hover:bg-edge"
            }`}
          >
            {s === "" ? "All" : s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Spinner />
      ) : !reports || reports.length === 0 ? (
        <Empty>No bug reports yet.</Empty>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <Link
              key={r.id}
              to={`/bugs/${r.id}`}
              className="card flex items-center justify-between gap-3 transition-colors hover:border-accent"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-white">{r.title}</div>
                <div className="text-xs text-gray-500">
                  {isAdmin && <>by {r.owner_username} · </>}
                  {r.message_count} message{r.message_count === 1 ? "" : "s"} · updated{" "}
                  {formatDate(r.updated_at)}
                </div>
              </div>
              <StatusBadge status={r.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
