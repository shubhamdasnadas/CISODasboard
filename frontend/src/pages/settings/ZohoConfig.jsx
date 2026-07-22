import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useProviders } from '../../context/ProviderContext';

export default function ZohoConfig() {
  const navigate = useNavigate();
  const { setSelectedProvider } = useProviders();

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [orgId, setOrgId] = useState('');
  const [domain, setDomain] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('idle');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/zoho/credentials').then(r => {
      if (r.data.clientId) setClientId(r.data.clientId);
      if (r.data.clientSecret) setClientSecret(r.data.clientSecret);
      if (r.data.redirectUri) setRedirectUri(r.data.redirectUri);
      if (r.data.orgId) setOrgId(r.data.orgId);
      if (r.data.domain) setDomain(r.data.domain);
      if (r.data.code) setCode(r.data.code);
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
      await api.put('/zoho/credentials', {
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        redirectUri: redirectUri.trim(),
        orgId: orgId.trim(),
        domain: domain.trim(),
        code: code.trim(),
      });
      setStatus('syncing');
      setMsg('Syncing Zoho tickets…');
      const r = await api.post('/zoho/credentials-sync');
      const failed = r.data.stale && !r.data.success;
      if (!failed) {
        setSelectedProvider('ticketing', 'Zoho Desk');
        setMsg((r.data.message || 'Sync complete') + ' — Zoho Desk is now the active ticketing tool.');
      } else {
        setMsg(r.data.message || 'Sync complete');
      }
      setStatus(failed ? 'error' : 'done');
    } catch (err) {
      setMsg(err.response?.data?.message || 'Sync failed');
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
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Zoho Desk Configuration</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Configure Zoho Desk ticketing integration</p>
        </div>
      </div>

      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--card-border)] bg-[var(--muted-bg)] flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <h3 className="font-semibold text-[var(--foreground)]">Zoho Desk</h3>
        </div>
        <div className="p-6 space-y-4">
          {[
            { label: 'Client ID', val: clientId, set: setClientId, ph: '1000.XXXXXXXXXX', type: 'text' },
            { label: 'Client Secret', val: clientSecret, set: setClientSecret, ph: 'Zoho API console client secret', type: 'password' },
            { label: 'Authorization Code (optional)', val: code, set: setCode, ph: 'Single-use OAuth code — leave blank to keep showing cached data', type: 'password' },
            { label: 'Redirect URI (optional)', val: redirectUri, set: setRedirectUri, ph: 'https://your-app.com/oauthgrant', type: 'text' },
            { label: 'Org ID (optional)', val: orgId, set: setOrgId, ph: 'e.g. 60021258041', type: 'text' },
            { label: 'Domain (optional)', val: domain, set: setDomain, ph: 'https://desk.zoho.in', type: 'text' },
          ].map(f => (
            <div key={f.label}>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{f.label}</label>
              <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          ))}
          <p className="text-xs text-[var(--muted)]">
            The authorization code is single-use and expires quickly. If it's left blank, already used, or expired, "Save & Sync" will keep showing the last successfully synced data instead of failing — paste in a fresh code from Zoho's OAuth consent screen whenever you want a live refresh.
          </p>
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