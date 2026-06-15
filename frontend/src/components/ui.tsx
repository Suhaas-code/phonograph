import { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-edge p-8 text-center text-sm text-gray-500">
      {children}
    </div>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  return <p className="text-sm text-red-400">{message}</p>;
}

export function Spinner() {
  return <div className="py-8 text-center text-sm text-gray-500">Loading…</div>;
}

export function QualityBadge({ tier }: { tier: string }) {
  const color =
    tier === "Hi-Res Lossless"
      ? "border-purple-500 text-purple-300"
      : tier === "Lossless"
        ? "border-emerald-500 text-emerald-300"
        : tier === "High Bitrate Lossy"
          ? "border-amber-500 text-amber-300"
          : "border-gray-600 text-gray-400";
  return <span className={`badge ${color}`}>{tier}</span>;
}
