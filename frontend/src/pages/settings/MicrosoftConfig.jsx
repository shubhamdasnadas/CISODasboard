import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';

const COOLDOWN_MS = 10 * 60 * 1000;

// Mirror of backend ENDPOINTS — label + key only
const ENDPOINTS = [
  { key: 'organization',           label: 'Organization',                  group: 'Directory' },
  { key: 'subscribedSkus',         label: 'Subscribed SKUs (Licenses)',    group: 'Directory' },
  { key: 'domains',                label: 'Domains',                       group: 'Directory' },
  { key: 'users',                  label: 'Users',                         group: 'Directory' },
  { key: 'auditSignIns',           label: 'Sign-In Logs',                  group: 'Audit Logs' },
  { key: 'auditDirectory',         label: 'Directory Audits',              group: 'Audit Logs' },
  { key: 'auditProvisioning',      label: 'Provisioning Logs',             group: 'Audit Logs' },
  { key: 'riskyUsers',             label: 'Risky Users',                   group: 'Identity Protection' },
  { key: 'riskDetections',         label: 'Risk Detections',               group: 'Identity Protection' },
  { key: 'riskyServicePrincipals', label: 'Risky Service Principals',      group: 'Identity Protection' },
  { key: 'securityIncidents',      label: 'Security Incidents',            group: 'Security' },
  { key: 'securityAlerts',         label: 'Security Alerts',               group: 'Security' },
  { key: 'secureScores',           label: 'Secure Scores',                 group: 'Security' },
  { key: 'secureScoreProfiles',    label: 'Secure Score Profiles',         group: 'Security' },
  { key: 'managedDevices',         label: 'Managed Devices',               group: 'Intune' },
  { key: 'compliancePolicies',     label: 'Compliance Policies',           group: 'Intune' },
  { key: 'deviceConfigurations',   label: 'Device Configurations',         group: 'Intune' },
  { key: 'applications',           label: 'Applications',                  group: 'Applications' },
  { key: 'servicePrincipals',      label: 'Service Principals',            group: 'Applications' },
  { key: 'serviceHealth',          label: 'Service Health Overviews',      group: 'Service Health' },
  { key: 'serviceIssues',          label: 'Service Issues',                group: 'Service Health' },
  { key: 'purviewTrigger',              label: 'Purview Triggers',                   group: 'Purview' },
  { key: 'purviewLabels',               label: 'Purview Labels',                      group: 'Purview' },
  { key: 'mgmtActivitySubscriptions',   label: 'Activity Feed Subscriptions',         group: 'Management Activity' },
  // Defender for Endpoint
  { key: 'defenderMachines',            label: 'Machines (Devices)',                  group: 'Defender for Endpoint' },
  { key: 'defenderAlerts',              label: 'Endpoint Alerts',                     group: 'Defender for Endpoint' },
  { key: 'defenderVulnerabilities',     label: 'Vulnerabilities',                     group: 'Defender for Endpoint' },
  { key: 'defenderRecommendations',     label: 'Security Recommendations',            group: 'Defender for Endpoint' },
  { key: 'defenderSoftware',            label: 'Installed Software',                  group: 'Defender for Endpoint' },
  { key: 'defenderIndicators',          label: 'Threat Indicators',                   group: 'Defender for Endpoint' },
  { key: 'defenderInvestigations',      label: 'Investigations',                      group: 'Defender for Endpoint' },
  { key: 'defenderLibraryFiles',        label: 'Library Files',                       group: 'Defender for Endpoint' },
];

const GROUPS = [...new Set(ENDPOINTS.map((e) => e.group))];

const GROUP_COLORS = {
  'Directory':            'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  'Audit Logs':           'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  'Identity Protection':  'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  'Security':             'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  'Intune':               'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  'Applications':         'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  'Service Health':       'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
  'Purview':              'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
  'Management Activity':  'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  'Defender for Endpoint': 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
};

export default function MicrosoftConfig() {
  const navigate = useNavigate();
  const [tenantId, setTenantId]       = useState('');
  const [clientId, setClientId]       = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [saveStatus, setSaveStatus]   = useState('idle'); // idle | saving | done | error
  const [saveMsg, setSaveMsg]         = useState('');
  const [syncing, setSyncing]         = useState(false);
  const [syncMsg, setSyncMsg]         = useState('');
  const [syncedAt, setSyncedAt]       = useState(null);
  const [epStatus, setEpStatus]       = useState({}); // key -> { ok, error } | 'pending'
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const lastRefreshRef = useRef(null);

  // Load saved credentials + last sync time
  useEffect(() => {
    api.get('/microsoft/credentials').then((r) => {
      if (r.data.tenantId) setTenantId(r.data.tenantId);
      if (r.data.clientId) setClientId(r.data.clientId);
      if (r.data.lastSyncedAt) setSyncedAt(r.data.lastSyncedAt);
    }).catch(() => {});
  }, []);

  // Cooldown ticker
  useEffect(() => {
    if (!lastRefreshRef.current) return;
    const id = setInterval(() => {
      const left = Math.max(0, COOLDOWN_MS - (Date.now() - lastRefreshRef.current));
      setCooldownLeft(left);
      if (left === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [syncing]); // re-arm after each sync

  const canSync = cooldownLeft === 0 && !syncing;

  const fmtCooldown = (ms) => {
    const s = Math.ceil(ms / 1000);
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  const handleSave = async () => {
    if (!tenantId.trim() || !clientId.trim() || !clientSecret.trim()) {
      setSaveMsg('All three fields are required'); setSaveStatus('error'); return;
    }
    setSaveStatus('saving'); setSaveMsg('');
    try {
      await api.post('/microsoft/credentials', {
        tenantId: tenantId.trim(), clientId: clientId.trim(), clientSecret: clientSecret.trim(),
      });
      setSaveStatus('done'); setSaveMsg('Credentials saved.');
    } catch (err) {
      setSaveStatus('error'); setSaveMsg(err.response?.data?.message || 'Save failed');
    }
  };

  const handleSync = useCallback(async () => {
    if (!canSync) return;
    setSyncing(true);
    setSyncMsg('Fetching access token…');
    setSyncedAt(null);
    // Set all endpoints to pending
    const pending = {};
    ENDPOINTS.forEach((e) => { pending[e.key] = 'pending'; });
    setEpStatus(pending);

    try {
      const r = await api.post('/microsoft/sync');
      // Start with every key marked as not-called, then overwrite with actual results
      const next = {};
      ENDPOINTS.forEach((e) => { next[e.key] = { ok: false, error: 'No response from server' }; });
      (r.data.results || []).forEach((item) => {
        if (item.key && item.key !== '?') next[item.key] = { ok: item.ok, error: item.error };
      });
      setEpStatus(next);
      setSyncedAt(r.data.syncedAt || new Date().toISOString());
      setSyncMsg(r.data.message || 'Sync complete');
      lastRefreshRef.current = Date.now();
      setCooldownLeft(COOLDOWN_MS);
    } catch (err) {
      setSyncMsg(err.response?.data?.message || 'Sync failed');
      const failed = {};
      ENDPOINTS.forEach((e) => { failed[e.key] = { ok: false, error: err.response?.data?.message || 'Request failed' }; });
      setEpStatus(failed);
    } finally {
      setSyncing(false);
    }
  }, [canSync]);

  const saveColor = { idle: '', saving: 'text-indigo-600', done: 'text-green-600', error: 'text-red-500' };

  const hasResults = Object.keys(epStatus).length > 0;
  const okCount      = Object.values(epStatus).filter((v) => v !== 'pending' && v.ok && !v.skipped).length;
  const skippedCount = Object.values(epStatus).filter((v) => v !== 'pending' && v.ok && v.skipped).length;
  const failCount    = Object.values(epStatus).filter((v) => v !== 'pending' && !v.ok).length;

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => navigate('/settings')} className="text-[var(--muted)] hover:text-[var(--foreground)] p-1.5 rounded-lg hover:bg-[var(--muted-bg)]">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Microsoft Configuration</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Microsoft Graph API — OAuth2 client credentials flow</p>
        </div>
      </div>

      {/* Credentials Card */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-[var(--card-border)] bg-[var(--muted-bg)] flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" viewBox="0 0 23 23" fill="currentColor">
              <path d="M1 1h10v10H1zm11 0h10v10H12zM1 12h10v10H1zm11 0h10v10H12z"/>
            </svg>
          </div>
          <h3 className="font-semibold text-[var(--foreground)]">Microsoft Entra ID (Azure AD)</h3>
        </div>
        <div className="p-6 space-y-4">
          {[
            { label: 'Tenant ID',     val: tenantId,     set: setTenantId,     ph: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', type: 'text' },
            { label: 'Client ID',     val: clientId,     set: setClientId,     ph: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', type: 'text' },
            { label: 'Client Secret', val: clientSecret, set: setClientSecret, ph: 'Your app client secret',               type: 'password' },
          ].map((f) => (
            <div key={f.label}>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{f.label}</label>
              <input type={f.type} value={f.val} onChange={(e) => f.set(e.target.value)} placeholder={f.ph}
                className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}

          <div className="flex items-center gap-3 pt-1 flex-wrap">
            {/* Save */}
            <button onClick={handleSave} disabled={saveStatus === 'saving'}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
              {saveStatus === 'saving'
                ? <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />Saving…</>
                : 'Save Credentials'}
            </button>

            {/* Sync — all endpoints in parallel */}
            <button onClick={handleSync} disabled={!canSync}
              title={!canSync && cooldownLeft > 0 ? `Next sync in ${fmtCooldown(cooldownLeft)}` : ''}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
              <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {syncing ? 'Syncing…' : cooldownLeft > 0 ? `Wait ${fmtCooldown(cooldownLeft)}` : 'Sync All Now'}
            </button>

            {saveMsg && <span className={`text-sm font-medium ${saveColor[saveStatus]}`}>{saveMsg}</span>}
          </div>

          {syncedAt && (
            <p className="text-xs text-[var(--muted)]">Last synced: {new Date(syncedAt).toLocaleString()}</p>
          )}
        </div>
      </div>

      {/* Sync Results — per-endpoint status grouped */}
      {hasResults && (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--card-border)] bg-[var(--muted-bg)] flex items-center justify-between">
            <h3 className="font-semibold text-[var(--foreground)]">Sync Results</h3>
            {!syncing && (
              <div className="flex items-center gap-3 text-xs font-medium">
                <span className="text-green-600">✓ {okCount} synced</span>
                {skippedCount > 0 && <span className="text-yellow-600">⊘ {skippedCount} skipped</span>}
                {failCount > 0 && <span className="text-red-500">✗ {failCount} failed</span>}
                {syncMsg && <span className="text-[var(--muted)]">{syncMsg}</span>}
              </div>
            )}
            {syncing && <span className="text-xs text-indigo-600 animate-pulse">Fetching all endpoints simultaneously…</span>}
          </div>

          <div className="p-4 space-y-4">
            {GROUPS.map((group) => {
              const eps = ENDPOINTS.filter((e) => e.group === group);
              return (
                <div key={group}>
                  <p className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md inline-block mb-2 ${GROUP_COLORS[group]}`}>
                    {group}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {eps.map((ep) => {
                      const st = epStatus[ep.key];
                      const isPending = st === 'pending';
                      const isOk      = st && st !== 'pending' && st.ok && !st.skipped;
                      const isSkipped = st && st !== 'pending' && st.ok && st.skipped;
                      const isFail    = st && st !== 'pending' && !st.ok;
                      return (
                        <div key={ep.key}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-sm
                            ${isPending  ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20' : ''}
                            ${isOk      ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' : ''}
                            ${isSkipped ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20' : ''}
                            ${isFail    ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20' : ''}
                            ${!st       ? 'border-[var(--card-border)] bg-[var(--muted-bg)]' : ''}
                          `}>
                          {isPending  && <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
                          {isOk       && <span className="text-green-600 flex-shrink-0 text-base leading-none">✓</span>}
                          {isSkipped  && <span className="text-yellow-500 flex-shrink-0 text-base leading-none">⊘</span>}
                          {isFail     && <span className="text-red-500 flex-shrink-0 text-base leading-none">✗</span>}
                          {!st        && <span className="w-3.5 h-3.5 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />}

                          <div className="min-w-0">
                            <p className={`font-medium truncate
                              ${isPending  ? 'text-indigo-700 dark:text-indigo-300' : ''}
                              ${isOk      ? 'text-green-700 dark:text-green-300' : ''}
                              ${isSkipped ? 'text-yellow-700 dark:text-yellow-300' : ''}
                              ${isFail    ? 'text-red-700 dark:text-red-300' : ''}
                              ${!st       ? 'text-[var(--muted)]' : ''}
                            `}>{ep.label}</p>
                            {isSkipped && (
                              <p className="text-[10px] text-yellow-600">Token not configured</p>
                            )}
                            {isFail && st.error && (
                              <p className="text-[10px] text-red-500 truncate">{st.error}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
