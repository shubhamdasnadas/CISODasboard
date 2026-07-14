import { Badge } from '../../components/UI.jsx';
import DynChart from '../dashboard/DynChart.jsx';

export default function SanctionsCard({ latest, screenedTerm }) {
  if (!latest) return <div className="text-xs text-muted">Not fetched yet.</div>;
  if (latest.response_data?.error) {
    return <div className="text-xs text-rose-400">{latest.response_data.message}</div>;
  }

  const data = latest.response_data?.data || {};
  const matches = data.matches || [];
  const chartRows = matches.map((m) => ({ name: m.name, score: Number(m.score) || 0 }));

  return (
    <>
      {screenedTerm && (
        <div className="text-xs text-muted mb-2">Screened against: <span className="font-medium">{screenedTerm}</span></div>
      )}

      <div className="mb-3">
        <Badge color={data.matchCount > 0 ? 'red' : 'green'}>{data.matchCount ?? 0} match{data.matchCount === 1 ? '' : 'es'}</Badge>
      </div>

      {chartRows.length > 0 && (
        <div className="h-40 mb-3">
          <DynChart rows={chartRows} xList={['name']} yList={['score']} chartType="bar" />
        </div>
      )}

      {matches.length > 0 && (
        <table className="w-full text-left text-xs mb-2">
          <thead className="text-muted border-b border-navy-700">
            <tr><th className="py-1">Name</th><th>Dataset</th><th>Topic</th></tr>
          </thead>
          <tbody>
            {matches.map((m, i) => (
              <tr key={i} className="border-b border-navy-700 last:border-0">
                <td className="py-1">{m.name}</td>
                <td className="text-muted">{(m.datasets || []).join(', ')}</td>
                <td className="text-muted">{m.topic || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="text-xs text-muted">
        Fetched: <Badge color="green">{new Date(latest.fetched_at).toLocaleString()}</Badge>
      </div>
    </>
  );
}
