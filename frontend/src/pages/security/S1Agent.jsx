import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api.js';

function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

const tooltipStyle = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 12 };

function DateFilter({ from, to, onFromChange, onToChange, onClear }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <input type="date" value={from} max={to || undefined}
        onChange={(e) => onFromChange(e.target.value)}
        className="text-[10px] px-1.5 py-0.5 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-indigo-400" />
      <span className="text-[10px] text-[var(--muted)]">→</span>
      <input type="date" value={to} min={from || undefined}
        onChange={(e) => onToChange(e.target.value)}
        className="text-[10px] px-1.5 py-0.5 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-indigo-400" />
      {(from || to) && (
        <button onClick={onClear} className="text-[10px] text-indigo-500 hover:text-indigo-700 font-semibold">✕</button>
      )}
    </div>
  );
}

function useCardFilter(agents) {
  const [from, setFrom] = useState('');
  const [to, setTo]     = useState('');
  const filtered = useMemo(() => {
    if (!from && !to) return agents;
    const f = from ? new Date(from) : null;
    const t = to   ? new Date(to + 'T23:59:59') : null;
    return agents.filter((a) => {
      const d = parseDate(a.lastActiveDate);
      if (!d) return false;
      if (f && d < f) return false;
      if (t && d > t) return false;
      return true;
    });
  }, [agents, from, to]);
  const clear = () => { setFrom(''); setTo(''); };
  return { from, to, setFrom, setTo, clear, filtered };
}

function KpiCard({ title, value, subtitle, accent, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4 flex flex-col gap-1 shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <p className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-widest">{title}</p>
      <p className="text-3xl font-bold" style={{ color: accent }}>{value}</p>
      {subtitle && <p className="text-[11px] text-[var(--muted)]">{subtitle}</p>}
    </div>
  );
}

function SectionCard({ title, count, controls, children }) {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 bg-[var(--muted-bg)] border-b border-[var(--card-border)] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-[var(--foreground)]">{title}</p>
          {count != null && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300">
              {count}
            </span>
          )}
        </div>
        {controls && <div className="flex items-center gap-2">{controls}</div>}
      </div>
      {children}
    </div>
  );
}

function TableWrap({ cols, rows, emptyMsg = 'None' }) {
  if (rows.length === 0) {
    return <div className="px-4 py-6 text-center text-sm text-[var(--muted)]">{emptyMsg}</div>;
  }
  return (
    <div className="overflow-x-auto max-h-64 overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10">
          <tr className="bg-[var(--muted-bg)]">
            {cols.map((c) => (
              <th key={c} className="px-3 py-2 text-left font-semibold text-[var(--muted)] uppercase tracking-wide whitespace-nowrap border-b border-[var(--card-border)]">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--card-border)]">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-[var(--muted-bg)]/60">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-[var(--foreground)] whitespace-nowrap max-w-[200px] truncate">{cell ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProgressBar({ value, max, color = '#6366f1' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-[var(--card-border)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] text-[var(--muted)] w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function S1Agent() {
  const navigate = useNavigate();
  const [agents, setAgents]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [openUser, setOpenUser] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');

  useEffect(() => {
    api.get('/sentinelone/db/agents')
      .then((r) => setAgents(r.data?.agents || r.data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const inactiveDays = (a) => Math.floor((Date.now() - new Date(a.lastActiveDate)) / 86400000);
  const scanAgeDays  = (a) => a.lastSuccessfulScanDate ? Math.floor((Date.now() - new Date(a.lastSuccessfulScanDate)) / 86400000) : null;
  const fmt          = (d) => d ? new Date(d).toLocaleDateString() : '—';

  // Global filtered agents by header date
  const filteredAgents = useMemo(() => {
    if (!dateFrom && !dateTo) return agents;
    const f = dateFrom ? new Date(dateFrom) : null;
    const t = dateTo   ? new Date(dateTo + 'T23:59:59') : null;
    return agents.filter((a) => {
      const d = parseDate(a.lastActiveDate);
      if (!d) return false;
      if (f && d < f) return false;
      if (t && d > t) return false;
      return true;
    });
  }, [agents, dateFrom, dateTo]);

  // Per-card filters
  const inactiveFilter   = useCardFilter(agents);
  const oldVersionFilter = useCardFilter(agents);
  const fwFilter         = useCardFilter(agents);
  const threatsFilter    = useCardFilter(agents);
  const scansFilter      = useCardFilter(agents);
  const userMapFilter    = useCardFilter(agents);
  const siteFilter       = useCardFilter(agents);
  const osFilter         = useCardFilter(agents);
  const networkFilter    = useCardFilter(agents);
  const riskyFilter      = useCardFilter(agents);

  const kpis = useMemo(() => {
    const total   = filteredAgents.length;
    const active  = filteredAgents.filter((a) => a.isActive).length;
    const inactive = total - active;
    const threats = filteredAgents.filter((a) => (a.activeThreats || 0) > 0).length;
    const outdated = filteredAgents.filter((a) => !a.isUpToDate).length;
    const health  = Math.round((active / Math.max(1, total)) * 100);
    return { total, active, inactive, threats, outdated, health };
  }, [filteredAgents]);

  const inactiveMachines = useMemo(() =>
    inactiveFilter.filtered.filter((a) => !a.isActive && inactiveDays(a) > 7)
      .sort((a, b) => inactiveDays(b) - inactiveDays(a))
  , [inactiveFilter.filtered]);

  const oldVersion = useMemo(() => oldVersionFilter.filtered.filter((a) => !a.isUpToDate), [oldVersionFilter.filtered]);

  const fwDisabled = useMemo(() => fwFilter.filtered.filter((a) => !a.firewallEnabled), [fwFilter.filtered]);

  const activeThreats = useMemo(() =>
    threatsFilter.filtered.filter((a) => (a.activeThreats || 0) > 0)
      .sort((a, b) => b.activeThreats - a.activeThreats)
  , [threatsFilter.filtered]);

  const oldScans = useMemo(() => scansFilter.filtered.filter((a) => a.scanStatus !== 'finished'), [scansFilter.filtered]);

  const userDeviceMap = useMemo(() => {
    const map = {};
    userMapFilter.filtered.forEach((a) => {
      const u = a.lastLoggedInUserName || 'Unknown';
      if (!map[u]) map[u] = [];
      map[u].push(a);
    });
    return Object.entries(map)
      .map(([user, devs]) => ({ user, total: devs.length, active: devs.filter((d) => d.isActive).length, inactive: devs.filter((d) => !d.isActive).length, devices: devs }))
      .sort((a, b) => b.total - a.total);
  }, [userMapFilter.filtered]);

  const siteHealth = useMemo(() => {
    const map = {};
    siteFilter.filtered.forEach((a) => {
      const s = a.siteName || 'Unknown';
      if (!map[s]) map[s] = { total: 0, active: 0 };
      map[s].total++;
      if (a.isActive) map[s].active++;
    });
    return Object.entries(map)
      .map(([site, { total, active }]) => ({ site, total, active, inactive: total - active, score: Math.round((active / total) * 100) }))
      .sort((a, b) => b.total - a.total);
  }, [siteFilter.filtered]);

  const osOutdated = useMemo(() => {
    const map = {};
    osFilter.filtered.forEach((a) => {
      const os = a.osName || 'Unknown';
      if (!map[os]) map[os] = { total: 0, outdated: 0 };
      map[os].total++;
      if (!a.isUpToDate) map[os].outdated++;
    });
    return Object.entries(map)
      .map(([os, { total, outdated }]) => ({ os, total, outdated, coverage: Math.round(((total - outdated) / total) * 100) }))
      .sort((a, b) => b.total - a.total);
  }, [osFilter.filtered]);

  const networkStatus = useMemo(() => {
    const map = {};
    networkFilter.filtered.forEach((a) => { const s = a.networkStatus || 'unknown'; map[s] = (map[s] || 0) + 1; });
    return Object.entries(map).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count);
  }, [networkFilter.filtered]);

  const topRisky = useMemo(() =>
    riskyFilter.filtered.map((a) => {
      const reasons = [];
      let score = 0;
      if ((a.activeThreats || 0) > 0) { score += a.activeThreats * 30; reasons.push(`${a.activeThreats} active threat(s)`); }
      if (a.infected)          { score += 20; reasons.push('infected'); }
      if (!a.firewallEnabled)  { score += 20; reasons.push('firewall off'); }
      if (!a.isActive)         { score += 15; reasons.push('inactive'); }
      if (!a.isUpToDate)       { score += 15; reasons.push('outdated'); }
      return { ...a, riskScore: score, reasons };
    })
    .filter((a) => a.riskScore > 0)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 20)
  , [riskyFilter.filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[300px] text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
        </div>
        <p className="text-base font-semibold text-[var(--foreground)]">No agent data</p>
        <p className="text-sm text-[var(--muted)] mt-1">Sync SentinelOne to populate agent analytics</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">

      {/* Header + Global Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">Agent Analytics</h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">
            {kpis.total} agents · SentinelOne
            {(dateFrom || dateTo) && (
              <span className="ml-2 text-indigo-500 font-medium">
                {dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : dateFrom ? `From ${dateFrom}` : `Until ${dateTo}`}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] text-[var(--muted)] font-medium">From</label>
            <input type="date" value={dateFrom} max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-[11px] px-2 py-1 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] text-[var(--muted)] font-medium">To</label>
            <input type="date" value={dateTo} min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-[11px] px-2 py-1 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-[11px] text-indigo-500 hover:text-indigo-700 font-semibold">Clear</button>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard title="Total Agents"   value={kpis.total}    accent="#3b82f6" />
        <KpiCard title="Active"         value={kpis.active}   accent="#10b981" subtitle={`${kpis.health}% health`} />
        <KpiCard title="Inactive"       value={kpis.inactive} accent="#ef4444" />
        <KpiCard title="Active Threats" value={kpis.threats}  accent="#f59e0b"
          onClick={() => navigate('/security/detail', { state: { dataset: 'agents', filterId: 'activeThreats', title: 'Endpoints with Active Threats' } })} />
        <KpiCard title="Outdated"       value={kpis.outdated} accent="#8b5cf6" />
        <KpiCard title="Health Score"   value={`${kpis.health}%`} accent="#06b6d4" subtitle="active/total" />
      </div>

      {/* 1. Inactive Machines */}
      <SectionCard title="Inactive Machines (>7 days)" count={inactiveMachines.length}
        controls={<DateFilter from={inactiveFilter.from} to={inactiveFilter.to} onFromChange={inactiveFilter.setFrom} onToChange={inactiveFilter.setTo} onClear={inactiveFilter.clear} />}>
        <TableWrap
          cols={['Machine', 'User', 'Site', 'Last Active', 'Days Inactive']}
          rows={inactiveMachines.map((a) => [a.computerName, a.lastLoggedInUserName, a.siteName, fmt(a.lastActiveDate), inactiveDays(a)])}
          emptyMsg="No inactive machines over 7 days"
        />
      </SectionCard>

      {/* 2. Old Agent Version */}
      <SectionCard title="Outdated Agent Version" count={oldVersion.length}
        controls={<DateFilter from={oldVersionFilter.from} to={oldVersionFilter.to} onFromChange={oldVersionFilter.setFrom} onToChange={oldVersionFilter.setTo} onClear={oldVersionFilter.clear} />}>
        <TableWrap
          cols={['Machine', 'User', 'Site', 'Current Version']}
          rows={oldVersion.map((a) => [a.computerName, a.lastLoggedInUserName, a.siteName, a.agentVersion])}
          emptyMsg="All agents are up to date"
        />
      </SectionCard>

      {/* 3. Firewall Disabled */}
      <SectionCard title="Firewall Disabled" count={fwDisabled.length}
        controls={<DateFilter from={fwFilter.from} to={fwFilter.to} onFromChange={fwFilter.setFrom} onToChange={fwFilter.setTo} onClear={fwFilter.clear} />}>
        <TableWrap
          cols={['Machine', 'User', 'Site', 'Last IP']}
          rows={fwDisabled.map((a) => [a.computerName, a.lastLoggedInUserName, a.siteName, a.lastIpToMgmt])}
          emptyMsg="All agents have firewall enabled"
        />
      </SectionCard>

      {/* 4. Active Threats */}
      <SectionCard title="Endpoints with Active Threats" count={activeThreats.length}
        controls={<DateFilter from={threatsFilter.from} to={threatsFilter.to} onFromChange={threatsFilter.setFrom} onToChange={threatsFilter.setTo} onClear={threatsFilter.clear} />}>
        <TableWrap
          cols={['Machine', 'User', 'Site', 'Threat Count', 'Mitigation Mode']}
          rows={activeThreats.map((a) => [a.computerName, a.lastLoggedInUserName, a.siteName, a.activeThreats, a.mitigationMode])}
          emptyMsg="No active threats"
        />
      </SectionCard>

      {/* 5. Old/Pending Scan */}
      <SectionCard title="Old / Pending Scan" count={oldScans.length}
        controls={<DateFilter from={scansFilter.from} to={scansFilter.to} onFromChange={scansFilter.setFrom} onToChange={scansFilter.setTo} onClear={scansFilter.clear} />}>
        <TableWrap
          cols={['Machine', 'User', 'Last Scan', 'Scan Age (days)', 'Status']}
          rows={oldScans.map((a) => [a.computerName, a.lastLoggedInUserName, fmt(a.lastSuccessfulScanDate), scanAgeDays(a), a.scanStatus])}
          emptyMsg="All scans finished"
        />
      </SectionCard>

      {/* 6. User–Device Mapping */}
      <SectionCard title="User–Device Mapping" count={userDeviceMap.length}
        controls={<DateFilter from={userMapFilter.from} to={userMapFilter.to} onFromChange={userMapFilter.setFrom} onToChange={userMapFilter.setTo} onClear={userMapFilter.clear} />}>
        <div className="overflow-x-auto max-h-80 overflow-y-auto divide-y divide-[var(--card-border)]">
          {userDeviceMap.length === 0
            ? <div className="px-4 py-6 text-center text-sm text-[var(--muted)]">No data</div>
            : userDeviceMap.map(({ user, total, active, inactive, devices }) => (
              <div key={user}>
                <button
                  onClick={() => setOpenUser(openUser === user ? null : user)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[var(--muted-bg)]/60 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <span className="text-xs font-semibold text-[var(--foreground)]">{user}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-[var(--muted)]">
                    <span>{total} devices</span>
                    <span className="text-green-600">{active} active</span>
                    <span className="text-red-500">{inactive} inactive</span>
                    <svg className={`w-3.5 h-3.5 transition-transform ${openUser === user ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </button>
                {openUser === user && (
                  <div className="px-4 pb-3 pt-1 bg-[var(--muted-bg)]/30">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr>
                          {['Machine', 'OS', 'Site', 'Status', 'Version'].map((c) => (
                            <th key={c} className="px-2 py-1 text-left font-bold text-[var(--muted)] uppercase tracking-wide">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--card-border)]">
                        {devices.map((d, i) => (
                          <tr key={i} className="hover:bg-[var(--card-bg)]">
                            <td className="px-2 py-1.5 font-medium text-[var(--foreground)]">{d.computerName}</td>
                            <td className="px-2 py-1.5 text-[var(--muted)]">{d.osName}</td>
                            <td className="px-2 py-1.5 text-[var(--muted)]">{d.siteName}</td>
                            <td className="px-2 py-1.5">
                              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${d.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                                {d.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-[var(--muted)]">{d.agentVersion}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          }
        </div>
      </SectionCard>

      {/* 7. Site Health Score */}
      <SectionCard title="Site Health Score"
        controls={<DateFilter from={siteFilter.from} to={siteFilter.to} onFromChange={siteFilter.setFrom} onToChange={siteFilter.setTo} onClear={siteFilter.clear} />}>
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[var(--muted-bg)]">
                {['Site', 'Total', 'Active', 'Inactive', 'Health'].map((c) => (
                  <th key={c} className="px-3 py-2 text-left font-semibold text-[var(--muted)] uppercase tracking-wide border-b border-[var(--card-border)] whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--card-border)]">
              {siteHealth.map(({ site, total, active, inactive, score }) => (
                <tr key={site} className="hover:bg-[var(--muted-bg)]/60">
                  <td className="px-3 py-2 font-medium text-[var(--foreground)]">{site}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{total}</td>
                  <td className="px-3 py-2 text-green-600">{active}</td>
                  <td className="px-3 py-2 text-red-500">{inactive}</td>
                  <td className="px-3 py-2 min-w-[120px]"><ProgressBar value={active} max={total} color="#10b981" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* 8. OS-wise Outdated */}
      <SectionCard title="OS-wise Outdated Agents"
        controls={<DateFilter from={osFilter.from} to={osFilter.to} onFromChange={osFilter.setFrom} onToChange={osFilter.setTo} onClear={osFilter.clear} />}>
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[var(--muted-bg)]">
                {['OS', 'Total Agents', 'Outdated', 'Coverage'].map((c) => (
                  <th key={c} className="px-3 py-2 text-left font-semibold text-[var(--muted)] uppercase tracking-wide border-b border-[var(--card-border)] whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--card-border)]">
              {osOutdated.map(({ os, total, outdated, coverage }) => (
                <tr key={os} className="hover:bg-[var(--muted-bg)]/60">
                  <td className="px-3 py-2 font-medium text-[var(--foreground)]">{os}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{total}</td>
                  <td className="px-3 py-2 text-yellow-600">{outdated}</td>
                  <td className="px-3 py-2 min-w-[120px]"><ProgressBar value={total - outdated} max={total} color="#6366f1" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* 9. Network Status Distribution */}
      <SectionCard title="Network Status Distribution"
        controls={<DateFilter from={networkFilter.from} to={networkFilter.to} onFromChange={networkFilter.setFrom} onToChange={networkFilter.setTo} onClear={networkFilter.clear} />}>
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[var(--muted-bg)]">
                {['Status', 'Count', 'Share'].map((c) => (
                  <th key={c} className="px-3 py-2 text-left font-semibold text-[var(--muted)] uppercase tracking-wide border-b border-[var(--card-border)] whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--card-border)]">
              {networkStatus.map(({ status, count }) => (
                <tr key={status} className="hover:bg-[var(--muted-bg)]/60">
                  <td className="px-3 py-2 font-medium text-[var(--foreground)] capitalize">{status}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{count}</td>
                  <td className="px-3 py-2 min-w-[140px]"><ProgressBar value={count} max={networkFilter.filtered.length} color="#3b82f6" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* 10. Top Risky Endpoints */}
      <SectionCard title="Top Risky Endpoints" count={topRisky.length}
        controls={<DateFilter from={riskyFilter.from} to={riskyFilter.to} onFromChange={riskyFilter.setFrom} onToChange={riskyFilter.setTo} onClear={riskyFilter.clear} />}>
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[var(--muted-bg)]">
                {['Endpoint', 'User', 'Risk Score', 'Reasons'].map((c) => (
                  <th key={c} className="px-3 py-2 text-left font-semibold text-[var(--muted)] uppercase tracking-wide border-b border-[var(--card-border)] whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--card-border)]">
              {topRisky.map((a, i) => (
                <tr
                  key={i}
                  onClick={() => navigate('/security/detail', { state: { dataset: 'agents', filterId: 'agentDetail', value: a.computerName, title: `Agent Detail: ${a.computerName}` } })}
                  className="hover:bg-[var(--muted-bg)]/60 cursor-pointer"
                >
                  <td className="px-3 py-2 font-medium text-[var(--foreground)]">{a.computerName}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{a.lastLoggedInUserName}</td>
                  <td className="px-3 py-2">
                    <span className={`font-bold ${a.riskScore >= 60 ? 'text-red-500' : a.riskScore >= 30 ? 'text-orange-500' : 'text-yellow-500'}`}>
                      {a.riskScore}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[var(--muted)]">{a.reasons.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

    </div>
  );
}
