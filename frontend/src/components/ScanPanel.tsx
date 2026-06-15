import { useRef, useState } from "react";
import { useScanLibrary } from "../api/hooks";
import { collectFromInput, isSupported, scanFiles, ScanProgress } from "../lib/scanner";
import type { ScannedFile } from "../types";
import { ErrorText } from "./ui";

// Allow <input webkitdirectory>; TS doesn't know this attribute by default.
declare module "react" {
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}

export default function ScanPanel({ libraryId }: { libraryId: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const scan = useScanLibrary();
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [scanned, setScanned] = useState<ScannedFile[] | null>(null);
  const [phase, setPhase] = useState<"idle" | "reading" | "ready" | "uploaded">("idle");
  const [error, setError] = useState<unknown>(null);

  async function onFolderPicked(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const entries = collectFromInput(fileList);
    const supportedCount = entries.filter((x) => isSupported(x.file.name)).length;
    if (supportedCount === 0) {
      setError(new Error("No supported audio files found in that folder."));
      return;
    }
    setPhase("reading");
    setScanned(null);
    try {
      const results = await scanFiles(entries, setProgress);
      setScanned(results);
      setPhase("ready");
    } catch (err) {
      setError(err);
      setPhase("idle");
    }
  }

  async function upload(replace: boolean) {
    if (!scanned) return;
    setError(null);
    try {
      await scan.mutateAsync({ id: libraryId, files: scanned, replace });
      setPhase("uploaded");
    } catch (err) {
      setError(err);
    }
  }

  function reset() {
    setScanned(null);
    setProgress(null);
    setPhase("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-white">Scan a folder</h2>
        <span className="text-xs text-gray-500">Metadata only — audio stays on your device</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={onFolderPicked}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          className="btn-primary"
          onClick={() => inputRef.current?.click()}
          disabled={phase === "reading"}
        >
          {phase === "reading" ? "Reading…" : "Select folder"}
        </button>
        {phase === "ready" && scanned && (
          <>
            <button className="btn-primary" onClick={() => upload(true)} disabled={scan.isPending}>
              {scan.isPending ? "Uploading…" : `Upload ${scanned.length} tracks (replace)`}
            </button>
            <button className="btn-ghost" onClick={() => upload(false)} disabled={scan.isPending}>
              Add without replacing
            </button>
            <button className="btn-ghost" onClick={reset}>
              Discard
            </button>
          </>
        )}
      </div>

      {phase === "reading" && progress && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-gray-400">
            <span className="truncate">{progress.currentFile || "Finishing…"}</span>
            <span>
              {progress.processed}/{progress.total}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded bg-edge">
            <div
              className="h-full bg-accent transition-all"
              style={{
                width: `${progress.total ? (progress.processed / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {phase === "ready" && scanned && (
        <div className="mt-4">
          <p className="mb-2 text-sm text-gray-300">
            Extracted metadata for <strong>{scanned.length}</strong> files. Preview:
          </p>
          <div className="max-h-48 overflow-auto rounded border border-edge text-xs">
            <table className="w-full">
              <thead className="sticky top-0 bg-panel text-left text-gray-500">
                <tr>
                  <th className="p-2">Artist</th>
                  <th className="p-2">Title</th>
                  <th className="p-2">Codec</th>
                  <th className="p-2">Quality</th>
                </tr>
              </thead>
              <tbody>
                {scanned.slice(0, 100).map((f, i) => (
                  <tr key={i} className="border-t border-edge/40">
                    <td className="p-2 text-gray-300">{f.artist || "—"}</td>
                    <td className="p-2 text-gray-300">{f.title || "(untitled)"}</td>
                    <td className="p-2 text-gray-400">{f.codec}</td>
                    <td className="p-2 text-gray-500">
                      {f.bit_depth ? `${f.bit_depth}-bit ` : ""}
                      {f.sample_rate ? `${f.sample_rate / 1000}kHz` : ""}
                      {f.bitrate ? `${f.bitrate}kbps` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {phase === "uploaded" && (
        <p className="mt-4 text-sm text-emerald-400">
          Scan uploaded. Tracks and variants have been updated.{" "}
          <button className="text-accent hover:underline" onClick={reset}>
            Scan again
          </button>
        </p>
      )}

      <ErrorText error={error} />
    </div>
  );
}
