import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useProviders } from '../../context/ProviderContext';

export default function SentinelOneConfig() {
  const navigate = useNavigate();
  const { setSelectedProvider } = useProviders();

  const [accountId, setAccountId] = useState('');
  const [tokenKey, setTokenKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [status, setStatus] = useState('idle');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/sentinelone/credentials').then(r => {
      if (r.data.accountId) setAccountId(r.data.accountId);
      if (r.data.tokenKey) setTokenKey(r.data.tokenKey);
      if (r.data.baseUrl) setBaseUrl(r.data.baseUrl);
    }).catch(() => {});
  }, []);

  const handleSaveSync = async () => {
    if (!tokenKey.trim()) {
      setMsg('Token Key is required');
      setStatus('error');
      return;
    }
    setStatus('saving');
    setMsg('Saving credentials…');
    try {
      await api.put('/sentinelone/credentials', {
        accountId: accountId.trim(),
        tokenKey: tokenKey.trim(),
        baseUrl: baseUrl.trim()
      });
      setStatus('syncing');
      setMsg('Syncing SentinelOne data…');
      const r = await api.post('/sentinelone/sync');
      const warnings = r.data.warnings?.length ? ` ⚠ ${r.data.warnings.join('; ')}` : '';
      if (!r.data.warnings?.length) {
        setSelectedProvider('edr', 'SentinelOne');
        setMsg((r.data.message || 'Sync complete') + ' — SentinelOne is now the active EDR.');
      } else {
        setMsg((r.data.message || 'Sync complete') + warnings);
      }
      setStatus(r.data.warnings?.length ? 'error' : 'done');
    } catch (err) {
      setMsg(err.response?.data?.message || 'Error');
      setStatus('error');
    }
  };

  const statusColor = (s) => ({
    idle: 'text-gray-500', saving: 'text-indigo-600', syncing: 'text-indigo-600',
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
          <h1 className="text-2xl font-bold text-[var(--foreground)]">SentinelOne Configuration</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Configure SentinelOne EDR integration</p>
        </div>
      </div>

      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--card-border)] bg-[var(--muted-bg)] flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="font-semibold text-[var(--foreground)]">SentinelOne</h3>
        </div>
        <div className="p-6 space-y-4">
          {[
            { label: 'Account ID', val: accountId, set: setAccountId, ph: 'e.g. 1234567890', type: 'text' },
            { label: 'Token Key', val: tokenKey, set: setTokenKey, ph: 'API token', type: 'password' },
            { label: 'Base URL (optional)', val: baseUrl, set: setBaseUrl, ph: 'https://your-console.sentinelone.net', type: 'text' },
          ].map(f => (
            <div key={f.label}>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{f.label}</label>
              <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          ))}
          <div className="flex items-center gap-4 pt-1">
            <button onClick={handleSaveSync} disabled={status === 'saving' || status === 'syncing'}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
              {status === 'saving' || status === 'syncing' ? (
                <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />{status === 'saving' ? 'Saving…' : 'Syncing…'}</>
              ) : 'Save & Sync'}
            </button>
            {msg && <span className={`text-sm font-medium ${statusColor(status)}`}>{msg}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}