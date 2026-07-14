import { StatCard } from '../../components/UI.jsx';

export default function OsintKpiStrip({ latestByTool, allResponses }) {
  const crtSh = latestByTool.CrtSh?.response_data?.data;
  const shodan = latestByTool.Shodan?.response_data?.data;
  const sanctions = latestByTool.OpenSanctions?.response_data?.data;

  const lastFetchedAt = allResponses.length
    ? Math.max(...allResponses.map((r) => new Date(r.fetched_at).getTime()))
    : null;
  const daysSinceLastScan = lastFetchedAt != null
    ? Math.floor((Date.now() - lastFetchedAt) / 86400000)
    : null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <StatCard label="Exposed subdomains" value={crtSh?.subdomainCount ?? '—'} />
      <StatCard label="Open ports (Shodan)" value={shodan?.ports?.length ?? '—'} />
      <StatCard label="Sanctions hits" value={sanctions?.matchCount ?? '—'} />
      <StatCard label="Days since last scan" value={daysSinceLastScan ?? '—'} />
    </div>
  );
}
