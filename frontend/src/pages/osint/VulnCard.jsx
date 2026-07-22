import { Badge } from '../../components/UI.jsx';

const SEVERITY_COLOR = { CRITICAL: 'red', HIGH: 'red', MEDIUM: 'amber', LOW: 'gray' };

// Shared by OSV (vulnCount/vulns[]) and NVD (single cveId/baseScore/baseSeverity).
export default function VulnCard({ toolId, latest }) {
  if (!latest) return <div className="text-xs text-muted">Not fetched yet.</div>;
  if (latest.response_data?.error) {
    return <div className="text-xs text-rose-400">{latest.response_data.message}</div>;
  }

  const data = latest.response_data?.data || {};

  if (toolId === 'NVD') {
    const severity = (data.baseSeverity || '').toUpperCase();
    return (
      <>
        <div className="flex items-center gap-2 mb-2">
          <span className="font-mono text-sm">{data.cveId || '—'}</span>
          {severity && <Badge color={SEVERITY_COLOR[severity] || 'gray'}>{severity} · {data.baseScore ?? '—'}</Badge>}
        </div>
        {data.description && <p className="text-xs text-muted mb-2">{data.description}</p>}
        <div className="text-xs text-muted">
          Fetched: <Badge color="green">{new Date(latest.fetched_at).toLocaleString()}</Badge>
        </div>
      </>
    );
  }

  // OSV
  const vulns = data.vulns || [];
  const vulnCount = data.vulnCount ?? vulns.length;
  return (
    <>
      <div className="mb-2">
        <Badge color={vulnCount > 0 ? 'red' : 'green'}>{vulnCount} known vulns</Badge>
      </div>
      {vulns.length > 0 && (
        <div className="max-h-32 overflow-auto text-xs space-y-2 mb-2">
          {vulns.map((v, i) => {
            // Cached rows fetched before this card's normalized shape existed
            // may still carry the raw OSV `severity: [{type, score}]` array —
            // only render it when it's already a primitive score.
            const severity = typeof v.severity === 'number' || typeof v.severity === 'string' ? v.severity : null;
            const summary = typeof v.summary === 'string' ? v.summary : null;
            return (
              <div key={v.id || i}>
                <span className="font-mono">{v.id}</span>
                {severity != null && <span className="text-muted"> · score {severity}</span>}
                {summary && <div className="text-muted">{summary}</div>}
              </div>
            );
          })}
        </div>
      )}
      <div className="text-xs text-muted">
        Fetched: <Badge color="green">{new Date(latest.fetched_at).toLocaleString()}</Badge>
      </div>
    </>
  );
}
