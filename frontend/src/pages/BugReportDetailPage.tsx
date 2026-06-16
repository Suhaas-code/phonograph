import { FormEvent, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useAddBugMessage, useBugReport, useSetBugStatus } from "../api/hooks";
import AuthImage from "../components/AuthImage";
import { PageHeader, Spinner, Empty, ErrorText } from "../components/ui";
import { formatDate } from "../lib/format";
import type { BugMessage } from "../types";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function Bubble({ message, mine }: { message: BugMessage; mine: boolean }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg border px-3 py-2 ${
          mine ? "border-accent/40 bg-accent/10" : "border-edge bg-panel"
        }`}
      >
        <div className="mb-1 flex items-center gap-2 text-xs text-gray-500">
          <span className="font-medium text-gray-300">{message.author_username}</span>
          <span>{formatDate(message.created_at)}</span>
        </div>
        {message.body && (
          <p className="whitespace-pre-wrap break-words text-sm text-gray-100">{message.body}</p>
        )}
        {message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((a) => (
              <AuthImage
                key={a.id}
                path={`/bugs/attachments/${a.id}`}
                alt={a.filename}
                className="max-h-56 rounded border border-edge"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BugReportDetailPage() {
  const { id } = useParams();
  const reportId = Number(id);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: report, isLoading } = useBugReport(reportId);
  const addMessage = useAddBugMessage();
  const setStatus = useSetBugStatus();

  const [body, setBody] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (isLoading) return <Spinner />;
  if (!report) return <Empty>Bug report not found.</Empty>;

  function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > MAX_IMAGE_BYTES) {
      setFileError("Image must be 5 MB or smaller.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setImage(f);
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!body.trim() && !image) return;
    await addMessage.mutateAsync({ id: reportId, body, images: image ? [image] : [] });
    setBody("");
    setImage(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const closed = report.status === "closed";

  return (
    <div>
      <Link to="/bugs" className="mb-3 inline-block text-sm text-accent hover:underline">
        ← All reports
      </Link>
      <PageHeader
        title={report.title}
        subtitle={`Reported by ${report.owner_username} · ${closed ? "closed" : "open"}`}
        actions={
          isAdmin ? (
            <button
              className={closed ? "btn-primary" : "btn-ghost"}
              disabled={setStatus.isPending}
              onClick={() =>
                setStatus.mutate({ id: reportId, status: closed ? "open" : "closed" })
              }
            >
              {closed ? "Reopen" : "Close"}
            </button>
          ) : (
            <span
              className={`badge ${
                closed ? "border-gray-600 text-gray-400" : "border-emerald-500 text-emerald-300"
              }`}
            >
              {report.status}
            </span>
          )
        }
      />

      <div className="card mb-4 space-y-3">
        {report.messages.length === 0 ? (
          <p className="text-sm text-gray-500">No messages yet — start the conversation below.</p>
        ) : (
          report.messages.map((m) => (
            <Bubble key={m.id} message={m} mine={m.author_id === user?.id} />
          ))
        )}
      </div>

      {closed && !isAdmin ? (
        <p className="text-sm text-gray-500">
          This report is closed. An admin can reopen it to continue the conversation.
        </p>
      ) : (
        <form onSubmit={send} className="card space-y-3">
          <textarea
            className="input min-h-[70px]"
            placeholder="Write a message…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={pickImage}
              className="text-sm text-gray-400 file:mr-3 file:rounded file:border file:border-edge file:bg-ink file:px-3 file:py-1.5 file:text-sm file:text-gray-200"
            />
            {image && <span className="text-xs text-gray-500">{image.name}</span>}
            <button
              className="btn-primary ml-auto"
              disabled={addMessage.isPending || (!body.trim() && !image)}
            >
              {addMessage.isPending ? "Sending…" : "Send"}
            </button>
          </div>
          {fileError && <p className="text-sm text-red-400">{fileError}</p>}
          <ErrorText error={addMessage.error} />
        </form>
      )}
    </div>
  );
}
