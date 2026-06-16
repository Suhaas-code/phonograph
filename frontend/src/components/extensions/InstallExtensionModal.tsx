import { FormEvent, useState } from "react";
import { usePreviewManifest, useInstallExtension } from "../../api/hooks";
import { ErrorText } from "../ui";
import type { ManifestPreview } from "../../types";

export default function InstallExtensionModal({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<ManifestPreview | null>(null);
  const previewManifest = usePreviewManifest();
  const install = useInstallExtension();

  async function onPreview(e: FormEvent) {
    e.preventDefault();
    const result = await previewManifest.mutateAsync(url.trim());
    setPreview(result);
  }

  async function onApprove() {
    if (!preview) return;
    await install.mutateAsync({
      manifest_url: url.trim(),
      approved_permissions: preview.required_permissions,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg space-y-4 rounded-lg border border-edge bg-panel p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Install extension</h2>
          <button className="btn-ghost px-2 py-1 text-xs" onClick={onClose}>
            Close
          </button>
        </div>

        {!preview ? (
          <form onSubmit={onPreview} className="space-y-3">
            <div>
              <label className="label">Manifest URL</label>
              <input
                className="input"
                placeholder="https://extension.example.com/manifest.json"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Phonograph fetches and validates the manifest. The extension runs as
                an independent service — its code never runs inside Phonograph.
              </p>
            </div>
            <ErrorText error={previewManifest.error} />
            <button
              className="btn-primary"
              disabled={previewManifest.isPending || !url.trim()}
            >
              {previewManifest.isPending ? "Validating…" : "Continue"}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="card space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-white">{preview.name}</span>
                <span className="text-xs text-gray-500">v{preview.version}</span>
              </div>
              <div className="text-xs text-gray-500">by {preview.author}</div>
              <div className="text-xs text-gray-500 break-all">{preview.endpoint_url}</div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {preview.capabilities.map((c) => (
                  <span key={c} className="badge border-sky-600 text-sky-300">
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="label">Requested permissions</div>
              {preview.required_permissions.length === 0 ? (
                <p className="text-sm text-gray-400">No permissions requested.</p>
              ) : (
                <ul className="space-y-2">
                  {preview.required_permissions.map((p) => (
                    <li key={p} className="rounded border border-edge p-2 text-sm">
                      <div className="font-medium text-gray-200">{p}</div>
                      <div className="text-xs text-gray-500">
                        {preview.permission_descriptions[p] ?? ""}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <ErrorText error={install.error} />
            <div className="flex gap-2">
              <button
                className="btn-primary"
                onClick={onApprove}
                disabled={install.isPending}
              >
                {install.isPending ? "Installing…" : "Approve & install"}
              </button>
              <button
                className="btn-ghost"
                onClick={() => setPreview(null)}
                disabled={install.isPending}
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
