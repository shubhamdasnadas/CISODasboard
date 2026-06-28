import { useEffect, useState } from 'react';
import api from '../api';
import { Card, PageHeader, StatCard, Badge } from '../components/UI.jsx';
import { useOrg } from '../context/OrgContext.jsx';

export default function Dashboard() {
  const user = JSON.parse(localStorage.getItem('ciso_user') || '{}');
  const { currentOrg, organisations } = useOrg();
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrg) return;
    (async () => {
      setLoading(true);
      try {
        const r = await api.get(`/responses/${currentOrg.id}`);
        setResponses(r.data.responses || []);
      } catch {
        setResponses([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentOrg]);

  if (!currentOrg) {
    return (
      <Card>
        <div className="text-muted">No organisation selected.</div>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user.username || 'User'}`}
        subtitle={`Viewing data for ${currentOrg.org_name}`}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Organisation" value={currentOrg.org_name} accent />
        <StatCard label="API Sources" value={responses.length} />
        <StatCard label="Role" value={user.role?.toUpperCase() || '—'} />
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
          🏢 {currentOrg.org_name}
          <Badge color="gray">id #{currentOrg.id}</Badge>
        </h2>

        {loading ? (
          <div className="text-muted">Loading dashboard…</div>
        ) : responses.length === 0 ? (
          <Card><div className="text-muted">No API responses yet for this organisation.</div></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {responses.map((r) => (
              <Card key={r.id}>
                <div className="flex justify-between items-center mb-2">
                  <div className="font-semibold">{r.api_name}</div>
                  <Badge color="green">live</Badge>
                </div>
                <div className="text-xs text-muted mb-2">
                  Last fetched: {new Date(r.fetched_at).toLocaleString()}
                </div>
                <pre className="text-xs bg-navy-900 rounded-lg p-3 max-h-40 overflow-auto text-muted">
                  {JSON.stringify(r.response_data, null, 2)}
                </pre>
              </Card>
            ))}
          </div>
        )}
      </div>

      {organisations.length > 1 && (
        <div className="mt-8 text-xs text-muted">
          💡 You have access to {organisations.length} organisations. Use the switcher in the top bar to view another.
        </div>
      )}
    </div>
  );
}