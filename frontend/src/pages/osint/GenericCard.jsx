import { Badge } from '../../components/UI.jsx';

// Fallback rendering for tools without a specialized visualization —
// same raw-JSON view the OSINT page used before per-tool cards existed.
export default function GenericCard({ latest }) {
  if (!latest) return <div className="text-xs text-muted">Not fetched yet.</div>;
  if (latest.response_data?.error) {
    return <div className="text-xs text-rose-400">{latest.response_data.message}</div>;
  }
  return (
    <>
      <div className="text-xs text-muted mb-2">
        Fetched: <Badge color="green">{new Date(latest.fetched_at).toLocaleString()}</Badge>
      </div>
      <pre className="text-xs bg-navy-900 rounded-lg p-3 max-h-60 overflow-auto text-muted">
        {JSON.stringify(latest.response_data?.data ?? latest.data, null, 2)}
      </pre>
    </>
  );
}
