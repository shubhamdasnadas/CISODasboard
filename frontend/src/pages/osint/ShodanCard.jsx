import { Badge } from '../../components/UI.jsx';

export default function ShodanCard({ latest }) {
  if (!latest) return <div className="text-xs text-muted">Not fetched yet.</div>;
  if (latest.response_data?.error) {
    return <div className="text-xs text-rose-400">{latest.response_data.message}</div>;
  }

  const data = latest.response_data?.data || {};
  const ports = data.ports || [];
  const vulns = data.vulns || [];

  return (
    <>
      {(data.org || data.isp) && (
        <div className="text-xs text-muted mb-2">{data.org || data.isp}</div>
      )}

      <div className="mb-3">
        <div className="text-xs text-muted mb-1">Open ports ({ports.length})</div>
        <div className="flex flex-wrap gap-1">
          {ports.length === 0 && <span className="text-xs text-muted">None found</span>}
          {ports.map((p) => <Badge key={p} color="accent">{p}</Badge>)}
        </div>
      </div>

      <div className="mb-3">
        <Badge color={vulns.length > 0 ? 'red' : 'green'}>
          {vulns.length} known vuln{vulns.length === 1 ? '' : 's'}
        </Badge>
        {vulns.length > 0 && (
          <div className="mt-2 max-h-24 overflow-auto text-xs font-mono text-muted space-y-0.5">
            {vulns.map((v) => <div key={v}>{v}</div>)}
          </div>
        )}
      </div>

      <div className="text-xs text-muted">
        Fetched: <Badge color="green">{new Date(latest.fetched_at).toLocaleString()}</Badge>
      </div>
    </>
  );
}
