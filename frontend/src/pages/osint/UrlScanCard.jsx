import { Badge } from '../../components/UI.jsx';
import DynChart from '../dashboard/DynChart.jsx';

export default function UrlScanCard({ latest }) {
  if (!latest) return <div className="text-xs text-muted">Not fetched yet.</div>;
  if (latest.response_data?.error) {
    return <div className="text-xs text-rose-400">{latest.response_data.message}</div>;
  }

  const data = latest.response_data?.data || {};
  const scanRows = Object.entries(data.scansByDay || {})
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, count]) => ({ date, count }));
  const recent = data.recent || [];

  return (
    <>
      <div className="flex gap-10 mb-3">
        <div>
          <div className="text-2xl font-bold">{data.totalScans ?? 0}</div>
          <div className="text-xs text-muted">Total scans</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{data.countryCount ?? 0}</div>
          <div className="text-xs text-muted">Countries served from</div>
        </div>
      </div>

      {scanRows.length > 1 && (
        <div className="h-32 mb-3">
          <DynChart rows={scanRows} xList={['date']} yList={['count']} chartType="bar" />
        </div>
      )}

      {recent.length > 0 && (
        <div className="w-full overflow-x-auto mb-2">
          <table className="w-full text-left text-xs">
            <thead className="text-muted border-b border-navy-700">
              <tr><th className="py-1 pr-2">Time</th><th className="pr-2">IP</th><th className="pr-2">Country</th><th className="pr-2">Status</th><th>Server</th></tr>
            </thead>
            <tbody>
              {recent.map((r, i) => (
                <tr key={i} className="border-b border-navy-700 last:border-0">
                  <td className="py-1 pr-2 whitespace-nowrap">{r.time ? new Date(r.time).toLocaleString() : '—'}</td>
                  <td className="font-mono text-muted pr-2 whitespace-nowrap">{r.ip || '—'}</td>
                  <td className="text-muted pr-2 whitespace-nowrap">{r.country || '—'}</td>
                  <td className="text-muted pr-2 whitespace-nowrap">{r.status || '—'}</td>
                  <td className="text-muted whitespace-nowrap">{r.server || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-muted mt-2">
        Fetched: <Badge color="green">{new Date(latest.fetched_at).toLocaleString()}</Badge>
      </div>
    </>
  );
}
