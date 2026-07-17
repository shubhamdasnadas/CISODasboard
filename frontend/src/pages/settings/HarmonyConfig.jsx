import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useProviders } from '../../context/ProviderContext';

export default function HarmonyConfig() {
  const navigate = useNavigate();
  const { setSelectedProvider } = useProviders();

  const [clientId, setClientId] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [status, setStatus] = useState('idle');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/harmony/credentials').then(r => {
      if (r.data.clientId) setClientId(r.data.clientId);
      if (r.data.accessKey) setAccessKey(r.data.accessKey);
    }).catch(() => {});
  }, []);

  const handleSaveSync = async () => {
    if (!clientId.trim() || !accessKey.trim()) {
      setMsg('Client ID and Access Key are required');
      setStatus('error');
      return;
    }
    setStatus('auth');
    setMsg('Authenticating…');
    try {
      await api.put('/harmony/credentials', { clientId: clientId.trim(), accessKey: accessKey.trim() });
      setStatus('fetching');
      setMsg('Fetching & saving events…');
      const r = await api.post('/harmony/sync');
      setMsg(`Sync complete — ${r.data.upserted} events saved (${r.data.totalInDb} total).`);
      setStatus('done');
    } catch (err) {
      setMsg(err.response?.data?.message || 'Sync failed');
      setStatus('error');
    }
  };

  const handleSet = () => {
    setSelectedProvider('emailSecurity', 'Check Point Harmony');
    navigate('/settings');
  };

  const statusColor = (s) => ({
    idle: 'text-gray-500', auth: 'text-indigo-600', fetching: 'text-indigo-600',
    done: 'text-green-600', error: 'text-red-500',
  }[s] || '');

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => navigate('/settings')} className="text-[var(--muted)] hover:text-[var(--foreground)] p-1.5 rounded-lg hover:bg-[var(--muted-bg)]">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Check Point Harmony Configuration</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Configure Harmony Email & Collaboration integration</p>
        </div>
      </div>

      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--card-border)] bg-[var(--muted-bg)] flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h3 className="font-semibold text-[var(--foreground)]">Check Point Harmony</h3>
        </div>
        <div className="p-6 space-y-4">
          {[
            { label: 'Client ID', val: clientId, set: setClientId, ph: 'e.g. 44550823d…', type: 'text' },
            { label: 'Access Key', val: accessKey, set: setAccessKey, ph: 'e.g. 0a204c1a2…', type: 'password' },
          ].map(f => (
            <div key={f.label}>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{f.label}</label>
              <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          ))}
          <div className="flex items-center gap-4 pt-1">
            <button onClick={handleSaveSync} disabled={status === 'auth' || status === 'fetching'}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
              {status === 'auth' || status === 'fetching' ? (
                <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />{status === 'auth' ? 'Authenticating…' : 'Syncing…'}</>
              ) : 'Save & Sync'}
            </button>
            {status === 'done' && (
              <button onClick={handleSet}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
                Set as Active Email Security
              </button>
            )}
            {msg && <span className={`text-sm font-medium ${statusColor(status)}`}>{msg}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}