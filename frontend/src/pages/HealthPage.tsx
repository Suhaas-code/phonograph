import { useHealth, useHealthHistory } from "../api/hooks";
import { PageHeader, Spinner } from "../components/ui";

function scoreColor(score: number): string {
  if (score >= 90) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  return "text-red-400";
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    healthy: "bg-green-900/50 text-green-300",
    degraded: "bg-yellow-900/50 text-yellow-300",
    unhealthy: "bg-red-900/50 text-red-300",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[status] ?? ""}`}>
      {status}
    </span>
  );
}

function CheckRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-gray-300">{label}</span>
      <span className="flex items-center gap-2">
        {detail && <span className="text-gray-500 text-xs">{detail}</span>}
        <span className={ok ? "text-green-400" : "text-red-400"}>{ok ? "pass" : "fail"}</span>
      </span>
    </div>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function HealthPage() {
  const { data: current, isLoading } = useHealth();
  const { data: history } = useHealthHistory();

  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Health" subtitle="System connectivity and uptime." />

      {current && (
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          {/* Score */}
          <div className="rounded-lg border border-edge bg-panel p-5 text-center">
            <div className={`text-5xl font-bold ${scoreColor(current.score)}`}>
              {current.score}
            </div>
            <div className="mt-1 text-xs text-gray-500">health score</div>
            <div className="mt-2">{statusBadge(current.status)}</div>
          </div>

          {/* Checks */}
          <div className="rounded-lg border border-edge bg-panel p-5">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              Checks
            </div>
            <div className="divide-y divide-edge">
              <CheckRow label="Database" ok={current.checks.database.status === "pass"} />
              <CheckRow
                label="Internet (1.1.1.1)"
                ok={current.checks.internet.status === "pass"}
                detail={
                  current.checks.internet.latency_ms != null
                    ? `${current.checks.internet.latency_ms} ms`
                    : undefined
                }
              />
            </div>
          </div>

          {/* Errors */}
          <div className="rounded-lg border border-edge bg-panel p-5">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              Errors (last 30 min)
            </div>
            <div
              className={`text-4xl font-bold ${current.error_count_30min > 0 ? "text-yellow-400" : "text-gray-400"}`}
            >
              {current.error_count_30min}
            </div>
            <div className="mt-1 text-xs text-gray-500">unhandled server errors</div>
            <div className="mt-3 text-xs text-gray-600">
              Last checked: {fmt(current.computed_at)}
            </div>
          </div>
        </div>
      )}

      {/* History table */}
      {history && history.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-gray-300">History</h2>
          <div className="overflow-x-auto rounded-lg border border-edge">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge text-left text-xs text-gray-500">
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Score</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">DB</th>
                  <th className="px-4 py-2">Internet</th>
                  <th className="px-4 py-2">Latency</th>
                  <th className="px-4 py-2">Errors</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r, i) => (
                  <tr key={i} className="border-b border-edge/50 last:border-0">
                    <td className="px-4 py-2 text-gray-400 text-xs">{fmt(r.computed_at)}</td>
                    <td className={`px-4 py-2 font-medium ${scoreColor(r.score)}`}>{r.score}</td>
                    <td className="px-4 py-2">{statusBadge(r.status)}</td>
                    <td className={`px-4 py-2 ${r.db_ok ? "text-green-400" : "text-red-400"}`}>
                      {r.db_ok ? "ok" : "fail"}
                    </td>
                    <td
                      className={`px-4 py-2 ${r.internet_ok ? "text-green-400" : "text-red-400"}`}
                    >
                      {r.internet_ok ? "ok" : "fail"}
                    </td>
                    <td className="px-4 py-2 text-gray-400">
                      {r.latency_ms != null ? `${r.latency_ms} ms` : "—"}
                    </td>
                    <td className={`px-4 py-2 ${r.error_count > 0 ? "text-yellow-400" : "text-gray-400"}`}>
                      {r.error_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
