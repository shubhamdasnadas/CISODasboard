import { useEffect, useState } from 'react';
import api from '../api';
import { Card, PageHeader, PrimaryButton, Select, Badge } from '../components/UI.jsx';
import { useOrg } from '../context/OrgContext.jsx';

export default function ApiResponses() {
  const [responses, setResponses] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const { currentOrg, switchOrg, organisations } = useOrg();

  async function loadResponses() {
    if (!currentOrg) return;
    const { data } = await api.get(`/responses/${currentOrg.id}`);
    setResponses(data.responses || []);
  }

  useEffect(() => { loadResponses(); /* eslint-disable-next-line */ }, [currentOrg]);

  async function refresh(apiName) {
    if (!currentOrg) return;
    setRefreshing(true);
    try {
      await api.post('/responses/fetch', { org_id: currentOrg.id, api_name: apiName });
      await loadResponses();
    } catch (err) {
      alert(err.response?.data?.error || 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  function handleSelectOrg(e) {
    const id = parseInt(e.target.value, 10);
    switchOrg(id);
  }

  return (
    <div>
      <PageHeader
        title="API Responses"
        subtitle={currentOrg ? `Latest cached responses for ${currentOrg.org_name}` : 'Latest cached responses from background polling'}
      />

      {organisations.length > 1 && (
        <Card className="mb-6">
          <label className="text-sm text-muted">Organisation</label>
          <Select
            className="mt-1"
            value={currentOrg?.id || ''}
            onChange={handleSelectOrg}
          >
            {organisations.map((o) => (
              <option key={o.id} value={o.id}>{o.org_name}</option>
            ))}
          </Select>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {responses.map((r) => (
          <Card key={r.id}>
            <div className="flex justify-between items-center mb-3">
              <div className="font-semibold">{r.api_name}</div>
              <PrimaryButton
                onClick={() => refresh(r.api_name)}
                disabled={refreshing}
              >
                {refreshing ? 'Refreshing...' : '↻ Refresh Now'}
              </PrimaryButton>
            </div>
            <div className="text-xs text-muted mb-2">
              Fetched: <Badge color="green">{new Date(r.fetched_at).toLocaleString()}</Badge>
            </div>
            <pre className="text-xs bg-navy-900 rounded-lg p-3 max-h-72 overflow-auto text-muted">
              {JSON.stringify(r.response_data, null, 2)}
            </pre>
          </Card>
        ))}
        {responses.length === 0 && (
          <Card className="text-muted md:col-span-2">
            No responses yet. Background job refreshes every 5 minutes, or click a "Refresh Now" button after adding a token.
          </Card>
        )}
      </div>
    </div>
  );
}