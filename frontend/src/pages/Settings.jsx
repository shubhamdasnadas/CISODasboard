import { useState, useEffect } from 'react';
import api from '../api';
import { useOrg } from '../context/OrgContext';

export default function Settings() {
  const { currentOrg } = useOrg();
  const user = JSON.parse(localStorage.getItem('ciso_user') || '{}');

  // ── SentinelOne ──────────────────────────────────────────────────────────
  const [s1AccountId, setS1AccountId] = useState('');
  const [s1TokenKey, setS1TokenKey] = useState('');
  const [s1BaseUrl, setS1BaseUrl] = useState('');
  const [s1Status, setS1Status] = useState('idle'); // idle|saving|syncing|done|error
  const [s1Msg, setS1Msg] = useState('');

  useEffect(() => {
    api.get('/sentinelone/credentials').then(r => {
      if (r.data.accountId) setS1AccountId(r.data.accountId);
      if (r.data.tokenKey) setS1TokenKey(r.data.tokenKey);
      if (r.data.baseUrl) setS1BaseUrl(r.data.baseUrl);
    }).catch(() => {});
  }, []);

  const handleS1SaveSync = async () => {
    if (!s1TokenKey.trim()) {
      setS1Msg('tokenKey is required');
      setS1Status('error');
      return;
    }
    setS1Status('saving'); setS1Msg('Saving credentials…');
    try {
      await api.put('/sentinelone/credentials', { accountId: s1AccountId.trim(), tokenKey: s1TokenKey.trim(), baseUrl: s1BaseUrl.trim() });
      setS1Status('syncing'); setS1Msg('Syncing SentinelOne data…');
      const r = await api.post('/sentinelone/sync');
      const warnings = r.data.warnings?.length ? ` ⚠ ${r.data.warnings.join('; ')}` : '';
      setS1Msg((r.data.message || 'Sync complete') + warnings);
      setS1Status(r.data.warnings?.length ? 'error' : 'done');
    } catch (err) {
      setS1Msg(err.response?.data?.message || 'Error');
      setS1Status('error');
    }
  };

  // ── Palo Alto Firewall ───────────────────────────────────────────────────
  const [fwBaseUrl, setFwBaseUrl] = useState('');
  const [fwApiKey, setFwApiKey] = useState('');
  const [fwStatus, setFwStatus] = useState('idle');
  const [fwMsg, setFwMsg] = useState('');

  useEffect(() => {
    api.get('/firewall/credentials').then(r => {
      if (r.data.baseUrl) setFwBaseUrl(r.data.baseUrl);
      if (r.data.apiKey) setFwApiKey(r.data.apiKey);
    }).catch(() => {});
  }, []);

  const handleFwSaveSync = async () => {
    if (!fwBaseUrl.trim() || !fwApiKey.trim()) {
      setFwMsg('Base URL and API Key are required'); setFwStatus('error'); return;
    }
    setFwStatus('saving'); setFwMsg('Saving credentials…');
    try {
      await api.put('/firewall/credentials', { baseUrl: fwBaseUrl.trim(), apiKey: fwApiKey.trim() });
      setFwStatus('syncing'); setFwMsg('Collecting firewall reports…');
      const r = await api.post('/firewall/collect');
      setFwMsg(`Done — ${r.data.success}/${r.data.total} reports saved.`);
      setFwStatus('done');
    } catch (err) {
      setFwMsg(err.response?.data?.message || 'Error');
      setFwStatus('error');
    }
  };

  // ── Harmony ──────────────────────────────────────────────────────────────
  const [cpClientId, setCpClientId] = useState('');
  const [cpAccessKey, setCpAccessKey] = useState('');
  const [cpStatus, setCpStatus] = useState('idle'); // idle|auth|fetching|done|error
  const [cpMsg, setCpMsg] = useState('');

  useEffect(() => {
    api.get('/harmony/credentials').then(r => {
      if (r.data.clientId) setCpClientId(r.data.clientId);
      if (r.data.accessKey) setCpAccessKey(r.data.accessKey);
    }).catch(() => {});
  }, []);

  const handleHarmonySync = async () => {
    if (!cpClientId.trim() || !cpAccessKey.trim()) {
      setCpMsg('Client ID and Access Key are required'); setCpStatus('error'); return;
    }
    setCpStatus('auth'); setCpMsg('Authenticating…');
    try {
      // Save credentials first
      await api.put('/harmony/credentials', { clientId: cpClientId.trim(), accessKey: cpAccessKey.trim() });
      // Trigger sync (backend fetches token + syncs)
      setCpStatus('fetching'); setCpMsg('Fetching & saving events…');
      const r = await api.post('/harmony/sync');
      setCpMsg(`Sync complete — ${r.data.upserted} events saved (${r.data.totalInDb} total).`);
      setCpStatus('done');
    } catch (err) {
      setCpMsg(err.response?.data?.message || 'Sync failed');
      setCpStatus('error');
    }
  };

  // ── Sync All ─────────────────────────────────────────────────────────────
  const [syncAllStatus, setSyncAllStatus] = useState('idle');
  const [syncStep, setSyncStep]           = useState(null);
  const [syncResults, setSyncResults]     = useState(null);
  const [syncedAt, setSyncedAt]           = useState(null);

  const parseSyncResults = (data) => {
    // Try to extract per-service rows from various backend shapes
    const results = data?.results || [];
    const byKey   = data || {};

    const extract = (keys, fallbackMsg) => {
      // Try array of results first
      for (const key of keys) {
        const found = results.find((r) => r.service?.toLowerCase().includes(key) || r.name?.toLowerCase().includes(key));
        if (found) return { ok: found.success ?? found.ok ?? false, msg: found.message || found.msg || fallbackMsg };
      }
      // Try top-level keys
      for (const key of keys) {
        if (byKey[key] !== undefined) {
          const v = byKey[key];
          if (typeof v === 'object') return { ok: v.success ?? v.ok ?? true, msg: v.message || v.msg || JSON.stringify(v).slice(0, 60) };
          return { ok: true, msg: String(v) };
        }
      }
      return null;
    };

    return {
      s1:      extract(['sentinelone', 's1', 'sentinel'], 'Synced'),
      firewall: extract(['firewall', 'paloalto', 'palo'], 'Synced'),
      harmony:  extract(['harmony', 'checkpoint', 'cp'], 'Synced'),
    };
  };

  const handleSyncAll = async () => {
    setSyncAllStatus('running'); setSyncResults(null);
    setSyncStep('authenticating');
    try {
      const r = await api.post('/sync/all');
      setSyncStep('done');
      setSyncResults(parseSyncResults(r.data));
      setSyncedAt(new Date().toLocaleString());
      setSyncAllStatus(r.data?.success !== false ? 'done' : 'error');
    } catch (err) {
      setSyncStep('done');
      setSyncResults({ s1: null, firewall: null, harmony: { ok: false, msg: err.response?.data?.message || 'Sync failed' } });
      setSyncAllStatus('error');
    }
  };

  const statusColor = (s) => ({
    idle: 'text-gray-500',
    auth: 'text-indigo-600',
    fetching: 'text-indigo-600',
    saving: 'text-indigo-600',
    syncing: 'text-indigo-600',
    done: 'text-green-600',
    error: 'text-red-500',
  }[s] || '');

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Settings</h1>
        {currentOrg && <p className="text-[var(--muted)] text-sm mt-1">{currentOrg.org_name}</p>}
      </div>

      <div className="space-y-5">
        {/* Account Info */}
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--card-border)] bg-[var(--muted-bg)]">
            <h3 className="font-semibold text-[var(--foreground)]">Account Information</h3>
          </div>
          <div className="p-6 space-y-0 divide-y divide-[var(--card-border)]">
            {[
              { label: 'Username', value: user.username },
              { label: 'Role', value: user.role },
              { label: 'Organisation', value: currentOrg?.org_name },
            ].filter(i => i.value).map(item => (
              <div key={item.label} className="flex items-center justify-between py-3.5">
                <p className="text-sm font-medium text-[var(--muted)]">{item.label}</p>
                <p className="text-sm text-[var(--foreground)] capitalize">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sync All */}
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-indigo-200 dark:border-indigo-800 bg-indigo-100 dark:bg-indigo-900/30 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-indigo-900 dark:text-indigo-200">Sync All Integrations</h3>
              <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-0.5">Runs SentinelOne, Firewall, and Harmony syncs for this org</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <button
                onClick={handleSyncAll}
                disabled={syncAllStatus === 'running'}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl text-sm font-semibold"
              >
                {syncAllStatus === 'running' ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    {syncStep === 'authenticating' ? 'Authenticating…' : 'Syncing…'}
                  </>
                ) : 'Sync All Now'}
              </button>
            </div>

            {/* Per-service results breakdown */}
            {syncResults && (
              <div className="border border-[var(--card-border)] rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-[var(--muted-bg)] border-b border-[var(--card-border)] flex items-center justify-between">
                  <p className="text-xs font-bold text-[var(--foreground)] uppercase tracking-widest">Sync Results</p>
                  {syncedAt && <p className="text-[10px] text-[var(--muted)]">Last synced: {syncedAt}</p>}
                </div>
                <div className="divide-y divide-[var(--card-border)]">
                  {[
                    { key: 's1',       label: 'SentinelOne', icon: '🛡️',  color: 'border-l-emerald-500' },
                    { key: 'firewall', label: 'Firewall',    icon: '🔥',  color: 'border-l-orange-500' },
                    { key: 'harmony',  label: 'Checkpoint',  icon: '✅',  color: 'border-l-indigo-500' },
                  ].map(({ key, label, icon, color }) => {
                    const row = syncResults[key];
                    if (!row) return null;
                    return (
                      <div key={key} className={`flex items-start gap-3 px-4 py-3 border-l-4 ${row.ok ? color : 'border-l-red-500'}`}>
                        <span className="text-sm mt-0.5">{icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[var(--foreground)]">{label}</p>
                          <p className={`text-[11px] mt-0.5 truncate ${row.ok ? 'text-[var(--muted)]' : 'text-red-500'}`}>{row.msg}</p>
                        </div>
                        <span className={`text-[10px] font-bold flex-shrink-0 mt-0.5 ${row.ok ? 'text-green-600' : 'text-red-500'}`}>
                          {row.ok ? '✓ OK' : '✗ Failed'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SentinelOne */}
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--card-border)] bg-[var(--muted-bg)] flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--foreground)]">SentinelOne</h3>
              <p className="text-xs text-[var(--muted)] mt-0.5">Endpoint protection — sync threats and agents</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {[
              { label: 'Account ID', val: s1AccountId, set: setS1AccountId, ph: 'e.g. 1234567890', type: 'text' },
              { label: 'Token Key', val: s1TokenKey, set: setS1TokenKey, ph: 'API token', type: 'password' },
              { label: 'Base URL (optional)', val: s1BaseUrl, set: setS1BaseUrl, ph: 'https://your-console.sentinelone.net', type: 'text' },
            ].map(f => (
              <div key={f.label}>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{f.label}</label>
                <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                  className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            ))}
            <div className="flex items-center gap-4 pt-1">
              <button onClick={handleS1SaveSync} disabled={s1Status === 'saving' || s1Status === 'syncing'}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
                {s1Status === 'saving' || s1Status === 'syncing' ? (
                  <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />{s1Status === 'saving' ? 'Saving…' : 'Syncing…'}</>
                ) : 'Save & Sync'}
              </button>
              {s1Msg && <span className={`text-sm font-medium ${statusColor(s1Status)}`}>{s1Msg}</span>}
            </div>
          </div>
        </div>

        {/* Palo Alto Firewall */}
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--card-border)] bg-[var(--muted-bg)] flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
              <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--foreground)]">Palo Alto Firewall</h3>
              <p className="text-xs text-[var(--muted)] mt-0.5">Network firewall — collect security reports</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {[
              { label: 'Base URL', val: fwBaseUrl, set: setFwBaseUrl, ph: 'https://192.168.1.1:443', type: 'text' },
              { label: 'API Key', val: fwApiKey, set: setFwApiKey, ph: 'Palo Alto API key', type: 'password' },
            ].map(f => (
              <div key={f.label}>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{f.label}</label>
                <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                  className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            ))}
            <div className="flex items-center gap-4 pt-1">
              <button onClick={handleFwSaveSync} disabled={fwStatus === 'saving' || fwStatus === 'syncing'}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
                {fwStatus === 'saving' || fwStatus === 'syncing' ? (
                  <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />{fwStatus === 'saving' ? 'Saving…' : 'Collecting…'}</>
                ) : 'Save & Collect'}
              </button>
              {fwMsg && <span className={`text-sm font-medium ${statusColor(fwStatus)}`}>{fwMsg}</span>}
            </div>
          </div>
        </div>

        {/* Check Point Harmony */}
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--card-border)] bg-[var(--muted-bg)] flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--foreground)]">Harmony Email & Collaboration</h3>
              <p className="text-xs text-[var(--muted)] mt-0.5">Check Point — fetch phishing, malware, DLP events</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {[
              { label: 'Client ID', val: cpClientId, set: setCpClientId, ph: 'e.g. 44550823d…', type: 'text' },
              { label: 'Access Key', val: cpAccessKey, set: setCpAccessKey, ph: 'e.g. 0a204c1a2…', type: 'password' },
            ].map(f => (
              <div key={f.label}>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{f.label}</label>
                <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                  className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            ))}
            <div className="flex items-center gap-4 pt-1">
              <button onClick={handleHarmonySync} disabled={cpStatus === 'auth' || cpStatus === 'fetching'}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
                {cpStatus === 'auth' || cpStatus === 'fetching' ? (
                  <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />{cpStatus === 'auth' ? 'Authenticating…' : 'Syncing…'}</>
                ) : 'Save & Sync'}
              </button>
              {cpMsg && <span className={`text-sm font-medium ${statusColor(cpStatus)}`}>{cpMsg}</span>}
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-2xl p-6">
          <h3 className="font-semibold text-red-900 dark:text-red-400 mb-1">Danger Zone</h3>
          <p className="text-sm text-red-700 dark:text-red-500 mb-4">These actions are irreversible.</p>
          <button className="bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-700">Delete Account</button>
        </div>
      </div>
    </div>
  );
}
