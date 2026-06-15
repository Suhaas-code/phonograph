// Browser metadata scanner (Phase 3).
//
// HARD INVARIANT: this module never uploads, streams, or transmits audio bytes.
// It reads each file locally in the browser, extracts metadata with
// music-metadata, and produces plain JSON describing the file. Only that JSON
// is later sent to the server.

import { parseBlob } from "music-metadata";
import type { ScannedFile } from "../types";

const SUPPORTED_EXTENSIONS = new Set([
  "flac",
  "mp3",
  "opus",
  "ogg",
  "aac",
  "m4a",
  "wav",
]);

// Map music-metadata container/codec hints to a normalized codec string.
function detectCodec(ext: string, codec: string | undefined): string {
  const c = (codec || "").toLowerCase();
  if (c.includes("flac")) return "flac";
  if (c.includes("mpeg") || c.includes("mp3")) return "mp3";
  if (c.includes("opus")) return "opus";
  if (c.includes("vorbis")) return "vorbis";
  if (c.includes("aac")) return "aac";
  if (c.includes("alac")) return "alac";
  if (c.includes("pcm")) return "wav";
  // Fall back to the file extension.
  return ext;
}

export function extensionOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

export function isSupported(name: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extensionOf(name));
}

function asInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Read a File handle and extract metadata. Returns null if parsing fails. */
export async function scanFile(file: File, relativePath: string): Promise<ScannedFile | null> {
  const ext = extensionOf(file.name);
  if (!SUPPORTED_EXTENSIONS.has(ext)) return null;

  try {
    const meta = await parseBlob(file, { duration: true });
    const common = meta.common || {};
    const format = meta.format || {};

    const codec = detectCodec(ext, format.codec);

    // Raw tags preserved verbatim (native + a snapshot of parsed common tags).
    const raw: Record<string, unknown> = {
      common: JSON.parse(JSON.stringify(common, replacer)),
      format: JSON.parse(JSON.stringify(format, replacer)),
    };

    return {
      title: (common.title || "").trim(),
      artist: (common.artist || (common.artists && common.artists[0]) || "").trim(),
      album: common.album || null,
      year: common.year ?? null,
      genre: common.genre && common.genre.length ? common.genre[0] : null,
      track_number: common.track?.no ?? null,
      disc_number: common.disk?.no ?? null,
      composer: common.composer && common.composer.length ? common.composer[0] : null,
      publisher: (common as { label?: string[] }).label?.[0] ?? null,
      replay_gain: common.replaygain_track_gain?.dB
        ? `${common.replaygain_track_gain.dB} dB`
        : null,
      comments:
        common.comment && common.comment.length
          ? String((common.comment[0] as { text?: string })?.text ?? common.comment[0])
          : null,
      duration: format.duration ?? null,
      codec,
      container: format.container || ext,
      bitrate: format.bitrate ? Math.round(format.bitrate / 1000) : null,
      bit_depth: asInt(format.bitsPerSample),
      sample_rate: asInt(format.sampleRate),
      channels: asInt(format.numberOfChannels),
      file_size: file.size,
      raw_metadata: raw,
      file_path: relativePath || file.name,
    };
  } catch {
    // Malformed/untaggable file: still record it with what we know.
    return {
      title: "",
      artist: "",
      file_path: relativePath || file.name,
      codec: ext,
      container: ext,
      file_size: file.size,
      raw_metadata: { error: "metadata_extraction_failed" },
    };
  }
}

// Drop binary blobs (cover art) from raw metadata so the JSON stays small and
// audio-adjacent binary never leaves the browser.
function replacer(key: string, value: unknown) {
  if (key === "picture") return undefined;
  if (value instanceof Uint8Array) return undefined;
  return value;
}

export interface ScanProgress {
  total: number;
  processed: number;
  skipped: number;
  currentFile: string;
}

/**
 * Scan a list of files (from a directory input), extracting metadata for every
 * supported audio file. Calls onProgress as it goes.
 */
export async function scanFiles(
  entries: { file: File; path: string }[],
  onProgress: (p: ScanProgress) => void
): Promise<ScannedFile[]> {
  const audio = entries.filter((e) => isSupported(e.file.name));
  const results: ScannedFile[] = [];
  let processed = 0;
  let skipped = 0;

  for (const entry of audio) {
    onProgress({
      total: audio.length,
      processed,
      skipped,
      currentFile: entry.path,
    });
    const scanned = await scanFile(entry.file, entry.path);
    if (scanned) results.push(scanned);
    else skipped += 1;
    processed += 1;
  }

  onProgress({ total: audio.length, processed, skipped, currentFile: "" });
  return results;
}

/**
 * Collect files from an <input type="file" webkitdirectory> FileList, preserving
 * the relative path within the chosen folder.
 */
export function collectFromInput(fileList: FileList): { file: File; path: string }[] {
  const entries: { file: File; path: string }[] = [];
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const path =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    entries.push({ file, path });
  }
  return entries;
}
