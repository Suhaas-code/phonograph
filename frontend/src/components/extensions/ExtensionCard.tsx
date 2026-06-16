import {
  useReapproveExtension,
  useRefreshExtension,
  useRemoveExtension,
  useSetExtensionEnabled,
  useUpdateExtension,
} from "../../api/hooks";
import { ErrorText } from "../ui";
import { formatDate } from "../../lib/format";
import type { Extension, ExtensionStatus } from "../../types";

function StatusBadge({ status }: { status: ExtensionStatus }) {
  const color =
    status === "enabled"
      ? "border-emerald-500 text-emerald-300"
      : status === "error"
        ? "border-red-500 text-red-300"
        : "border-gray-600 text-gray-400";
  return <span className={`badge ${color}`}>{status}</span>;
}

export default function ExtensionCard({ ext }: { ext: Extension }) {
  const setEnabled = useSetExtensionEnabled();
  const refresh = useRefreshExtension();
  const update = useUpdateExtension();
  const reapprove = useReapproveExtension();
  const remove = useRemoveExtension();

  const busy =
    setEnabled.isPending ||
    refresh.isPending ||
    update.isPending ||
    reapprove.isPending ||
    remove.isPending;
  const enabled = ext.status === "enabled";

  function onRemove() {
    if (window.confirm(`Remove "${ext.name}"? Metadata it already added is kept.`)) {
      remove.mutate(ext.id);
    }
  }

  function onReapprove() {
    reapprove.mutate({
      id: ext.id,
      manifest_url: ext.manifest_url,
      approved_permissions: ext.requested_permissions,
    });
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="truncate font-medium text-white">{ext.name}</span>
            <span className="text-xs text-gray-500">v{ext.version}</span>
          </div>
          <div className="truncate text-xs text-gray-500">by {ext.author}</div>
        </div>
        <StatusBadge status={ext.status} />
      </div>

      {ext.granted_permissions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {ext.granted_permissions.map((p) => (
            <span key={p} className="badge border-edge text-gray-300">
              {p}
            </span>
          ))}
        </div>
      )}

      <div className="text-xs text-gray-500">
        {ext.last_refresh_at
          ? `Last refreshed ${formatDate(ext.last_refresh_at)}`
          : "Never refreshed"}
      </div>

      {ext.status === "error" && ext.last_error && (
        <p className="text-sm text-red-400">{ext.last_error}</p>
      )}

      {ext.needs_reapproval && (
        <div className="rounded border border-amber-600 bg-amber-950/30 p-2 text-sm">
          <div className="text-amber-300">This update requests new permissions.</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {ext.requested_permissions.map((p) => (
              <span key={p} className="badge border-amber-600 text-amber-300">
                {p}
              </span>
            ))}
          </div>
          <button
            className="btn-primary mt-2"
            onClick={onReapprove}
            disabled={busy}
          >
            Re-approve permissions
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          className="btn-primary"
          onClick={() => refresh.mutate(ext.id)}
          disabled={busy || !enabled || ext.needs_reapproval}
        >
          {refresh.isPending ? "Refreshing…" : "Refresh metadata"}
        </button>
        <button
          className="btn-ghost"
          onClick={() => setEnabled.mutate({ id: ext.id, enabled: !enabled })}
          disabled={busy}
        >
          {enabled ? "Disable" : "Enable"}
        </button>
        <button
          className="btn-ghost"
          onClick={() => update.mutate(ext.id)}
          disabled={busy}
        >
          {update.isPending ? "Updating…" : "Update"}
        </button>
        <button className="btn-danger" onClick={onRemove} disabled={busy}>
          Remove
        </button>
      </div>

      <ErrorText error={refresh.error || update.error || reapprove.error || remove.error} />
    </div>
  );
}
