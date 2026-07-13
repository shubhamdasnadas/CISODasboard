import { useEffect, useState } from 'react';
import api from '../api';
import { Card, PageHeader, PrimaryButton, Badge } from '../components/UI.jsx';
import { useOrg } from '../context/OrgContext.jsx';

export default function Osint() {
  const { currentOrg } = useOrg();
  const [tools, setTools] = useState([]);
  const [configuredApiNames, setConfiguredApiNames] = useState([]);
  const [responses, setResponses] = useState({});
  const [fetchingId, setFetchingId] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!currentOrg) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/osint/${currentOrg.id}`);
      setTools(data.tools || []);
      setConfiguredApiNames(data.configuredApiNames || []);
      const byName = {};
      (data.responses || []).forEach((r) => { byName[r.api_name] = r; });
      setResponses(byName);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentOrg]);

  async function fetchTool(toolId) {
    if (!currentOrg) return;
    setFetchingId(toolId);
    try {
      const { data } = await api.post('/osint/fetch', { org_id: currentOrg.id, tool_id: toolId });
      if (data.configured === false) {
        setConfiguredApiNames((prev) => prev.filter((n) => n !== toolId));
      } else {
        setResponses((prev) => ({ ...prev, [toolId]: data }));
        setConfiguredApiNames((prev) => (prev.includes(toolId) ? prev : [...prev, toolId]));
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Fetch failed');
    } finally {
      setFetchingId(null);
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="OSINT Intel" subtitle="Loading tools…" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="OSINT Intel"
        subtitle={currentOrg ? `Threat intel lookups for ${currentOrg.org_name}` : 'Threat intel lookups'}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => {
          const isConfigured = !tool.needsKey || configuredApiNames.includes(tool.id);
          const response = responses[tool.id];
          const isFetching = fetchingId === tool.id;

          return (
            <Card key={tool.id}>
              <div className="flex justify-between items-start mb-3 gap-2">
                <div className="font-semibold">{tool.label}</div>
                <Badge color={tool.needsKey ? 'accent' : 'green'}>
                  {tool.needsKey ? 'API key' : 'Free'}
                </Badge>
              </div>

              {!isConfigured ? (
                <div className="text-xs text-muted">
                  No API key configured. Add one on the{' '}
                  <a href="/tokens" className="underline">API Tokens</a> page
                  {' '}(api_name: <span className="font-mono">{tool.id}</span>
                  {tool.keyFields === 2 ? ', format: id:secret' : ''}).
                </div>
              ) : (
                <>
                  <PrimaryButton onClick={() => fetchTool(tool.id)} disabled={isFetching} className="mb-3">
                    {isFetching ? 'Fetching…' : response ? '↻ Refresh' : 'Fetch'}
                  </PrimaryButton>

                  {response ? (
                    response.response_data?.error ? (
                      <div className="text-xs text-rose-400">{response.response_data.message}</div>
                    ) : (
                      <>
                        <div className="text-xs text-muted mb-2">
                          Fetched: <Badge color="green">{new Date(response.fetched_at).toLocaleString()}</Badge>
                        </div>
                        <pre className="text-xs bg-navy-900 rounded-lg p-3 max-h-60 overflow-auto text-muted">
                          {JSON.stringify(response.response_data?.data ?? response.data, null, 2)}
                        </pre>
                      </>
                    )
                  ) : (
                    <div className="text-xs text-muted">Not fetched yet.</div>
                  )}
                </>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
