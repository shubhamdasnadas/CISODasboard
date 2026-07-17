import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useProviders } from '../../context/ProviderContext';

export default function CrowdStrikeConfig() {
  const navigate = useNavigate();
  const { setSelectedProvider } = useProviders();
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [status, setStatus] = useState('idle');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/crowdstrike/credentials').then(r => {
      if (r.data.clientId) setClientId(r.data.clientId);
      if (r.data.clientSecret) setClientSecret(r.data.clientSecret);
    }).catch(() => {});
  }, []);

  const handleSaveSync = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      setMsg('Client ID and Client Secret are required');
      setStatus('error');
      return;
    }
    setStatus('saving');
    setMsg('Saving credentials…');
    try {
      await api.put('/crowdstrike/credentials', { clientId: clientId.trim(), clientSecret: clientSecret.trim() });
      setStatus('syncing');
      setMsg('Syncing CrowdStrike data…');
      const r = await api.post('/crowdstrike/sync');
      setSelectedProvider('edr', 'CrowdStrike');
      setMsg((r.data.message || 'Sync complete') + ' — CrowdStrike is now the active EDR.');
      setStatus('done');
    } catch (err) {
      setMsg(err.response?.data?.message || 'Error');
      setStatus('error');
    }
  };

  const statusColor = (s) => ({
    idle: 'text-gray-500',
    saving: 'text-indigo-600',
    syncing: 'text-indigo-600',
    done: 'text-green-600',
    error: 'text-red-500',
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
          <h1 className="text-2xl font-bold text-[var(--foreground)]">CrowdStrike Configuration</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Configure CrowdStrike EDR integration</p>
        </div>
      </div>

      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--card-border)] bg-[var(--muted-bg)] flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
            <span className="text-purple-600">🔒</span>
          </div>
          <h3 className="font-semibold text-[var(--foreground)]">CrowdStrike</h3>
        </div>

        <div className="p-6 space-y-4">
          {[
            { label: 'Client ID', val: clientId, set: setClientId, ph: 'e.g. abc123def456', type: 'text' },
            { label: 'Client Secret', val: clientSecret, set: setClientSecret, ph: 'API secret key', type: 'password' },
          ].map(f => (
            <div key={f.label}>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{f.label}</label>
              <input
                type={f.type}
                value={f.val}
                onChange={e => f.set(e.target.value)}
                placeholder={f.ph}
                className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          ))}

          <div className="flex items-center gap-4 pt-1">
            <button
              onClick={handleSaveSync}
              disabled={status === 'saving' || status === 'syncing'}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-semibold"
            >
              {status === 'saving' || status === 'syncing' ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  {status === 'saving' ? 'Saving…' : 'Syncing…'}
                </>
              ) : 'Save & Sync'}
            </button>
            {msg && <span className={`text-sm font-medium ${statusColor(status)}`}>{msg}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
