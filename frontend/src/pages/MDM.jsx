import { useState, useEffect } from 'react';
import api from '../api';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1'];

function Spin() {
  return (
    <div className="flex items-center justify-center h-full min-h-[100px]">
      <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
    </div>
  );
}
function Empty({ msg }) {
  return (
    <div className="flex items-center justify-center h-full min-h-[80px] px-4 text-center">
      <p className="text-sm text-[var(--muted)]">{msg}</p>
    </div>
  );
}

function CardShell({ title, children, className = '' }) {
  return (
    <div className={`bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden shadow-sm flex flex-col ${className}`}>
      <div className="px-5 py-3.5 border-b border-[var(--card-border)] bg-[var(--muted-bg)]">
        <h3 className="text-sm font-bold text-[var(--foreground)]">{title}</h3>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

export default function MDM() {
  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [apps, setApps] = useState([]);
  const [appsLoading, setAppsLoading] = useState(true);

  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [deviceApps, setDeviceApps] = useState([]);
  const [deviceAppsLoading, setDeviceAppsLoading] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const loadDevices = () => {
    setDevicesLoading(true);
    api.get('/hexnode/db/devices')
      .then((r) => setDevices(Array.isArray(r.data?.data) ? r.data.data : []))
      .catch(() => setDevices([]))
      .finally(() => setDevicesLoading(false));
  };

  const loadApps = () => {
    setAppsLoading(true);
    api.get('/hexnode/db/applications')
      .then((r) => setApps(Array.isArray(r.data?.data) ? r.data.data : []))
      .catch(() => setApps([]))
      .finally(() => setAppsLoading(false));
  };

  useEffect(() => {
    loadDevices();
    loadApps();
    api.get('/hexnode/credentials').then((r) => setLastSyncedAt(r.data?.lastSyncedAt ?? null)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedDeviceId) { setDeviceApps([]); return; }
    setDeviceAppsLoading(true);
    api.get(`/hexnode/db/device-applications?deviceId=${encodeURIComponent(selectedDeviceId)}`)
      .then((r) => setDeviceApps(Array.isArray(r.data?.data) ? r.data.data : []))
      .catch(() => setDeviceApps([]))
      .finally(() => setDeviceAppsLoading(false));
  }, [selectedDeviceId]);

  const handleSync = async () => {
    setSyncing(true); setSyncMsg(null);
    try {
      const r = await api.post('/hexnode/sync');
      const warnings = r.data.warnings?.length ? ` ⚠ ${r.data.warnings.join('; ')}` : '';
      setSyncMsg({ text: (r.data.message || 'Sync complete') + warnings, ok: !r.data.warnings?.length });
      loadDevices();
      loadApps();
      setLastSyncedAt(new Date().toISOString());
    } catch (err) {
      setSyncMsg({ text: err.response?.data?.message || 'Sync failed — configure credentials in Settings', ok: false });
    } finally {
      setSyncing(false);
    }
  };

  const osCounts = {};
  devices.forEach((d) => {
    const os = d.os_name || d.os_type || d.platform || d.os || 'Unknown';
    osCounts[os] = (osCounts[os] || 0) + 1;
  });
  const osData = Object.entries(osCounts).map(([name, value], i) => ({ name, value, fill: COLORS[i % COLORS.length] }));

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">MDM</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {lastSyncedAt ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}` : 'Hexnode mobile device management'}
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-semibold"
        >
          {syncing ? <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />Syncing…</> : 'Sync'}
        </button>
      </div>

      {syncMsg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
          syncMsg.ok ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                     : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
        }`}>{syncMsg.text}</div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5">
          <p className="text-3xl font-bold text-[var(--foreground)] leading-none">{devicesLoading ? '—' : devices.length}</p>
          <p className="text-xs text-[var(--muted)] mt-1.5 font-medium">Enrolled devices</p>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5">
          <p className="text-3xl font-bold text-[var(--foreground)] leading-none">{appsLoading ? '—' : apps.length}</p>
          <p className="text-xs text-[var(--muted)] mt-1.5 font-medium">Applications tracked</p>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5">
          <p className="text-3xl font-bold text-[var(--foreground)] leading-none">{osData.length}</p>
          <p className="text-xs text-[var(--muted)] mt-1.5 font-medium">OS / platform variants</p>
        </div>
      </div>

      {/* Device Inventory + OS Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <CardShell title="Device Inventory" className="lg:col-span-2 h-[420px]">
          <div className="h-full overflow-auto">
            {devicesLoading ? <Spin /> : devices.length === 0 ? <Empty msg="No devices found — configure & sync Hexnode in Settings" /> : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[var(--muted-bg)]">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold text-[var(--muted)] border-b border-[var(--card-border)]">Device</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-[var(--muted)] border-b border-[var(--card-border)]">OS</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-[var(--muted)] border-b border-[var(--card-border)]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d, i) => {
                    const name = d.device_name || d.name || d.model || `Device ${d.id ?? i}`;
                    const os = d.os_name || d.os_type || d.platform || '—';
                    const status = d.compliance_state || d.enrollment_status || d.status || 'unknown';
                    const isGood = /compliant|active|enrolled/i.test(String(status));
                    return (
                      <tr key={i} className={i % 2 === 0 ? 'bg-[var(--card-bg)]' : 'bg-[var(--muted-bg)]'}>
                        <td className="px-4 py-2.5 border-b border-[var(--card-border)] text-[var(--foreground)] font-medium">{name}</td>
                        <td className="px-4 py-2.5 border-b border-[var(--card-border)] text-[var(--muted)]">{os}</td>
                        <td className="px-4 py-2.5 border-b border-[var(--card-border)]">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${isGood ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'}`}>{String(status).replace(/_/g, ' ')}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </CardShell>

        <CardShell title="OS / Platform Breakdown" className="h-[420px]">
          <div className="h-full p-3">
            {devicesLoading ? <Spin /> : osData.length === 0 ? <Empty msg="No device data" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={osData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="50%" outerRadius="70%" paddingAngle={2}>
                    {osData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip />
                  <Legend iconSize={9} wrapperStyle={{ fontSize: 11, color: 'var(--muted)' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardShell>
      </div>

      {/* Application Inventory + Per-Device Installed Apps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CardShell title="Application Inventory" className="h-[420px]">
          <div className="h-full overflow-auto">
            {appsLoading ? <Spin /> : apps.length === 0 ? <Empty msg="No applications found — configure & sync Hexnode in Settings" /> : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[var(--muted-bg)]">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold text-[var(--muted)] border-b border-[var(--card-border)]">Application</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-[var(--muted)] border-b border-[var(--card-border)]">Version</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.map((a, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-[var(--card-bg)]' : 'bg-[var(--muted-bg)]'}>
                      <td className="px-4 py-2.5 border-b border-[var(--card-border)] text-[var(--foreground)] font-medium">{a.name || a.app_name || 'Unknown'}</td>
                      <td className="px-4 py-2.5 border-b border-[var(--card-border)] text-[var(--muted)]">{a.version || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardShell>

        <CardShell title="Per-Device Installed Apps" className="h-[420px]">
          <div className="flex flex-col h-full">
            <div className="px-4 py-3 border-b border-[var(--card-border)]">
              <select value={selectedDeviceId} onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="w-full h-9 border border-[var(--input-border)] rounded-lg px-3 text-sm font-medium text-[var(--foreground)] bg-[var(--card-bg)] focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="">Select a device…</option>
                {devices.map((d, i) => (
                  <option key={d.id ?? i} value={d.id ?? ''}>{d.device_name || d.name || d.model || `Device ${d.id ?? i}`}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              {!selectedDeviceId ? <Empty msg="Select a device to view its installed apps" /> :
                deviceAppsLoading ? <Spin /> : deviceApps.length === 0 ? <Empty msg="No apps found for this device" /> : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-[var(--muted-bg)]">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold text-[var(--muted)] border-b border-[var(--card-border)]">Application</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-[var(--muted)] border-b border-[var(--card-border)]">Version</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deviceApps.map((a, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-[var(--card-bg)]' : 'bg-[var(--muted-bg)]'}>
                        <td className="px-4 py-2.5 border-b border-[var(--card-border)] text-[var(--foreground)] font-medium">{a.name || a.app_name || 'Unknown'}</td>
                        <td className="px-4 py-2.5 border-b border-[var(--card-border)] text-[var(--muted)]">{a.version || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </CardShell>
      </div>

      {/* Placeholders — not yet connected */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['Device Location', 'Data Usage', 'App Data Usage'].map((title) => (
          <CardShell key={title} title={title} className="h-[160px]">
            <div className="h-full flex items-center justify-center px-4 text-center">
              <p className="text-xs text-[var(--muted)]">Not connected yet — {title.toLowerCase()} sync is not wired up.</p>
            </div>
          </CardShell>
        ))}
      </div>
    </div>
  );
}
