export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "—";
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}

// File format (codec) for display, e.g. "FLAC", "MP3". Blank if unknown.
export function formatCodec(codec: string | null | undefined): string {
  return codec ? codec.toUpperCase() : "";
}

// "24-bit · 96 kHz", or just one part, or blank if both unknown.
export function formatBitSample(
  bitDepth: number | null | undefined,
  sampleRate: number | null | undefined
): string {
  const parts: string[] = [];
  if (bitDepth) parts.push(`${bitDepth}-bit`);
  if (sampleRate) parts.push(`${(sampleRate / 1000).toString().replace(/\.0$/, "")} kHz`);
  return parts.join(" · ");
}

export function formatBitrate(bitrate: number | null | undefined): string {
  return bitrate ? `${bitrate} kbps` : "";
}

export const SERVICE_LABELS: Record<string, string> = {
  spotify: "Spotify",
  tidal: "Tidal",
  qobuz: "Qobuz",
  deezer: "Deezer",
  amazon_music: "Amazon Music",
  youtube_music: "YouTube Music",
};

// Friendly label for any provider key — known ones get their proper name,
// custom/extension ones are title-cased from the stored key.
export function serviceLabel(service: string): string {
  if (SERVICE_LABELS[service]) return SERVICE_LABELS[service];
  return service
    .split(/[_\s]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
