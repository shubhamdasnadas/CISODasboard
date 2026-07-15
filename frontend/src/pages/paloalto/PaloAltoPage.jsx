import { useState, useEffect, useMemo } from 'react';
import api from '../../api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  ComposedChart, Line, PieChart, Pie,
} from 'recharts';

const COLORS = ['#3b82f6','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16','#f97316','#6366f1'];
const RISK_COLORS = { '1':'#22c55e','2':'#84cc16','3':'#f59e0b','4':'#f97316','5':'#ef4444' };

const REPORTS_TO_FETCH = [
  'risk-trend','top-attacker-sources','top-attacker-destinations',
  'top-denied-destinations','top-denied-sources','top-denied-applications',
  'risky-users','top-attacks','top-connections',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const parseNumber = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const str = String(v).replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
  const n = Number(str);
  return Number.isFinite(n) ? n : 0;
};

const formatNumber = (v) => Number(v || 0).toLocaleString('en-IN');

const formatBytes = (v) => {
  const b = parseNumber(v);
  if (b >= 1e12) return `${(b / 1e12).toFixed(2)} TB`;
  if (b >= 1e9) return `${(b / 1e9).toFixed(2)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(2)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(2)} KB`;
  return `${b} B`;
};

const toArray = (v) => {
  if (Array.isArray(v) && v.length > 0) return v;
  if (v && typeof v === 'object' && !Array.isArray(v)) return [v];
  return undefined;
};

const extractTable = (raw) => {
  if (!raw) return null;
  try {
    const entry =
      toArray(raw?.report?.result?.entry) ||
      toArray(raw?.report?.result?.report?.entry) ||
      toArray(raw?.response?.result?.report?.entry) ||
      toArray(raw?.response?.result?.entry) ||
      toArray(raw?.result?.report?.entry) ||
      toArray(raw?.result?.entry) ||
      toArray(raw?.entry);
    if (entry && entry.length > 0) {
      const colSet = new Set();
      entry.forEach(item => {
        if (typeof item === 'object' && item !== null)
          Object.keys(item).forEach(k => { if (k === '@name') colSet.add('name'); else if (!k.startsWith('@')) colSet.add(k); });
      });
      const columns = Array.from(colSet);
      const rows = entry.map(item => {
        const row = {};
        columns.forEach(col => {
          const rk = col === 'name' ? '@name' : col;
          const value = item?.[rk] ?? item?.[col];
          row[col] = typeof value === 'object' && value !== null && '#text' in value ? value['#text'] : value ?? '';
        });
        return row;
      });
      return { columns, rows };
    }
    if (Array.isArray(raw)) {
      const columns = Array.from(new Set(raw.flatMap(item => Object.keys(item || {}))));
      return { columns, rows: raw };
    }
    if (typeof raw === 'object') {
      const columns = Object.keys(raw).filter(k => typeof raw[k] !== 'object');
      if (columns.length > 0) return { columns, rows: [raw] };
    }
  } catch (e) { /* ignore */ }
  return null;
};

const getFirstValue = (row, cols, fallback = '-') => {
  for (const col of cols) {
    const v = row?.[col];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return fallback;
};

const getSumByColumn = (rows, cols) => {
  const col = cols.find(c => rows.some(r => r[c] !== undefined && r[c] !== null && r[c] !== ''));
  if (!col) return 0;
  return rows.reduce((sum, r) => sum + parseNumber(r[col]), 0);
};

const getRowsByReport = (allReports, name) => allReports.find(r => r.report === name)?.rows ?? [];

// Firewall reports don't carry a date query param server-side — the backend
// always returns the same full snapshot regardless of startDate/endDate.
// So the date filter is applied client-side against each row's own
// timestamp column instead of re-fetching from the API.
const DATE_COLS = ['slabbed-receive_time', 'receive_time', 'time_generated', 'time', 'date', 'updatedAt'];

const getRowDate = (row) => {
  const raw = getFirstValue(row, DATE_COLS, null);
  if (!raw || raw === '-') return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
};

const filterRowsByDate = (rows, dateRange) => {
  if (!dateRange || (!dateRange.from && !dateRange.to)) return rows;
  return rows.filter(row => {
    const d = getRowDate(row);
    if (!d) return true; // keep rows with no recognizable date rather than dropping them
    const key = d.toISOString().slice(0, 10);
    if (dateRange.from && key < dateRange.from) return false;
    if (dateRange.to && key > dateRange.to) return false;
    return true;
  });
};

const makeTopChartData = (rows, cols, limit = 8) => {
  const map = new Map();
  rows.forEach(row => {
    const value = String(getFirstValue(row, cols, '')).trim();
    if (!value || value === '-') return;
    const n = parseNumber(getFirstValue(row, ['count','nrepeat','nsess','sessions','threats'], 1));
    map.set(value, (map.get(value) || 0) + (n || 1));
  });
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .reverse()
    .map(([name, value]) => ({ name: name.length > 28 ? name.slice(0, 28) + '…' : name, value }));
};

const makeRiskTrendData = (rows) => {
  const map = new Map();
  rows.forEach(row => {
    const rawDate = getFirstValue(row, ['slabbed-receive_time','receive_time','time','date','updatedAt']);
    const date = rawDate && rawDate !== '-' ? new Date(rawDate).toLocaleDateString('en-CA') : null;
    if (!date || date === 'Invalid Date') return;
    const old = map.get(date) || { date, sessions: 0, traffic: 0 };
    old.sessions += parseNumber(getFirstValue(row, ['nsess','sessions','session','count'], 1));
    old.traffic += parseNumber(getFirstValue(row, ['nbytes','bytes','byte'], 0));
    map.set(date, old);
  });
  return Array.from(map.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
};

const makeRiskDistribution = (rows) => {
  const map = new Map();
  rows.forEach(row => {
    const risk = String(getFirstValue(row, ['risk','severity','name'], '-'));
    const count = parseNumber(getFirstValue(row, ['count','nrepeat','nsess','sessions'], 1));
    if (!risk || risk === '-') return;
    map.set(risk, (map.get(risk) || 0) + (count || 1));
  });
  return Array.from(map.entries())
    .map(([risk, value]) => ({ name: `Risk ${risk}`, risk, value }))
    .sort((a, b) => parseNumber(a.risk) - parseNumber(b.risk));
};

const getSecurityScoreStatus = (score) => {
  if (score >= 90) return { label: 'Excellent', color: '#22c55e' };
  if (score >= 70) return { label: 'Warning', color: '#f59e0b' };
  return { label: 'Critical', color: '#ef4444' };
};

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ title, value, subtitle, icon, color }) {
  return (
    <div className="relative flex min-h-[156px] w-full overflow-hidden rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-1 bg-[var(--card-bg)] border-[var(--card-border)]">
      <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-[40px]" style={{ backgroundColor: color, opacity: 0.15 }} />
      <div className="flex w-full flex-col justify-between pr-12">
        <div>
          <p className="max-w-[135px] text-[11px] font-black uppercase leading-4 tracking-wide text-[var(--muted)]">{title}</p>
          <h2 className="mt-3 max-w-full break-words text-[24px] font-black leading-[1.15] text-[var(--foreground)]" title={String(value)}>{value}</h2>
        </div>
        <p className="mt-3 text-sm font-medium leading-5 text-[var(--muted)]">{subtitle}</p>
      </div>
      <div className="absolute right-4 top-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg text-white shadow-sm" style={{ backgroundColor: color }}>
        {icon}
      </div>
    </div>
  );
}

function DateFilterInput({ label, value, onChange }) {
  return (
    <div className="flex flex-col">
      <label className="mb-1 text-xs font-semibold uppercase text-[var(--muted)]">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border px-3 py-2 text-sm font-medium bg-[var(--card-bg)] border-[var(--card-border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
      />
    </div>
  );
}

function ChartCard({ title, subtitle, children, dateRange, onDateChange }) {
  return (
    <div className="rounded-2xl border p-4 sm:p-5 bg-[var(--card-bg)] border-[var(--card-border)]">
      <div className="mb-4">
        <h3 className="text-base font-extrabold sm:text-lg text-[var(--foreground)]">{title}</h3>
        <p className="mb-3 text-sm text-[var(--muted)]">{subtitle}</p>

        {/* Date Filter */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <DateFilterInput
            label="From"
            value={dateRange.from}
            onChange={(value) => onDateChange({ ...dateRange, from: value })}
          />
          <DateFilterInput
            label="To"
            value={dateRange.to}
            onChange={(value) => onDateChange({ ...dateRange, to: value })}
          />
        </div>
      </div>

      {children}
    </div>
  );
}

function GlobalDateFilter({ globalDateRange, onGlobalDateChange }) {
  return (
    <div className="mb-6 rounded-2xl border p-4 sm:p-5 bg-[var(--card-bg)] border-[var(--card-border)]">
      <h3 className="mb-4 text-base font-extrabold text-[var(--foreground)]">Global Date Filter</h3>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <DateFilterInput
          label="From"
          value={globalDateRange.from}
          onChange={(value) => onGlobalDateChange({ ...globalDateRange, from: value })}
        />
        <DateFilterInput
          label="To"
          value={globalDateRange.to}
          onChange={(value) => onGlobalDateChange({ ...globalDateRange, to: value })}
        />
        <button
          onClick={() => onGlobalDateChange({ from: '', to: '' })}
          className="rounded-lg px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 bg-[#6366f1]"
        >
          Reset Filters
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PaloAltoPage() {
  const [globalDateRange, setGlobalDateRange] = useState({ from: '', to: '' });
  const [componentDateRanges, setComponentDateRanges] = useState({
    riskTrend: { from: '', to: '' },
    riskDistribution: { from: '', to: '' },
    topAttacks: { from: '', to: '' },
    topSources: { from: '', to: '' },
    topDeniedDestinations: { from: '', to: '' },
    topConnections: { from: '', to: '' },
  });
  
  const [allReports, setAllReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAllReports = async () => {
    setLoading(true);
    setError('');
    try {
      const results = await Promise.allSettled(
        REPORTS_TO_FETCH.map(name =>
          api.get(`/firewall/reports/${name}`).then(r => {
            const raw = r.data?.data ?? r.data;
            const table = extractTable(raw);
            return { report: name, rows: table?.rows ?? [], columns: table?.columns ?? [] };
          })
        )
      );
      setAllReports(results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value));
    } catch (e) {
      setError(e.message || 'Failed to fetch firewall reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllReports();
  }, []);

  const handleGlobalDateChange = (newRange) => {
    setGlobalDateRange(newRange);
  };

  const handleComponentDateChange = (componentName, newRange) => {
    setComponentDateRanges(prev => ({
      ...prev,
      [componentName]: newRange
    }));
  };

  // All report rows are already fetched in full — the backend has no
  // date-range support, so filtering happens here against each row's own
  // timestamp instead of re-querying the API.
  const filteredReports = useMemo(
    () => allReports.map(r => ({ ...r, rows: filterRowsByDate(r.rows, globalDateRange) })),
    [allReports, globalDateRange]
  );

  const allRows = useMemo(
    () => filteredReports.flatMap(r => r.rows),
    [filteredReports]
  );

  const dashboard = useMemo(() => {
    const riskRowsAll = getRowsByReport(filteredReports, 'risk-trend');
    const riskTrendRows = filterRowsByDate(riskRowsAll, componentDateRanges.riskTrend);
    const riskDistRows  = filterRowsByDate(riskRowsAll, componentDateRanges.riskDistribution);

    const attackerSourceRowsAll = getRowsByReport(filteredReports, 'top-attacker-sources');
    const attackerSourceRows = filterRowsByDate(attackerSourceRowsAll, componentDateRanges.topSources);

    const attackerDestRows = getRowsByReport(filteredReports, 'top-attacker-destinations');

    const deniedRowsAll = [
      ...getRowsByReport(filteredReports, 'top-denied-destinations'),
      ...getRowsByReport(filteredReports, 'top-denied-sources'),
      ...getRowsByReport(filteredReports, 'top-denied-applications'),
    ];
    const deniedRows = filterRowsByDate(deniedRowsAll, componentDateRanges.topDeniedDestinations);

    const riskyUserRows = getRowsByReport(filteredReports, 'risky-users');

    const topAttackRowsAll = getRowsByReport(filteredReports, 'top-attacks');
    const topAttackRows = filterRowsByDate(topAttackRowsAll, componentDateRanges.topAttacks);

    const connectionRowsAll = getRowsByReport(filteredReports, 'top-connections');
    const connectionRows = filterRowsByDate(connectionRowsAll, componentDateRanges.topConnections);

    const totalSessions = getSumByColumn(allRows, ['nsess','sessions','session','count']);
    const totalTraffic = getSumByColumn(allRows, ['nbytes','bytes','byte']);

    const highRiskEvents = riskRowsAll.reduce((sum, row) => {
      const risk = parseNumber(getFirstValue(row, ['risk','name','severity'], 0));
      if (risk >= 4) return sum + parseNumber(getFirstValue(row, ['count','nrepeat','nsess','sessions'], 1));
      return sum;
    }, 0);

    const blockedConnections = deniedRows.length || allRows.filter(row => {
      const action = String(getFirstValue(row, ['action','category','name'], '')).toLowerCase();
      return action.includes('block') || action.includes('deny') || action.includes('drop');
    }).length;

    const topDestination = makeTopChartData(
      attackerDestRows.length ? attackerDestRows : allRows,
      ['dst','destination','destination_ip','name']
    )[0]?.name || '-';

    const criticalUsers = riskyUserRows.length;
    const securityScore = Math.max(0, Math.min(100, Math.round(100 - highRiskEvents * 0.05 - criticalUsers * 2 - blockedConnections * 0.1)));

    return {
      totalSessions,
      totalTraffic,
      highRiskEvents,
      topDestination,
      securityScore,
      riskTrendData: makeRiskTrendData(riskTrendRows.length ? riskTrendRows : allRows),
      riskDistribution: makeRiskDistribution(riskDistRows),
      topAttacks: makeTopChartData(topAttackRows.length ? topAttackRows : allRows, ['threatid','threat','name','category']),
      topSources: makeTopChartData(attackerSourceRows.length ? attackerSourceRows : allRows, ['src','source','source_ip','name']),
      topDeniedDestinations: makeTopChartData(deniedRows.length ? deniedRows : allRows, ['dst','destination','destination_ip','name']),
      topConnections: makeTopChartData(connectionRows.length ? connectionRows : allRows, ['name','src','source','dst','destination']),
    };
  }, [filteredReports, allRows, componentDateRanges]);

  const scoreStatus = getSecurityScoreStatus(dashboard.securityScore);

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 bg-[var(--background)]">
      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black text-[var(--foreground)]">Firewall SOC / NOC Dashboard</h1>
          <p className="text-sm text-[var(--muted)]">
            Palo Alto firewall reports · {formatNumber(allRows.length)} total rows
          </p>
        </div>
        <button
          onClick={fetchAllReports}
          disabled={loading}
          className="rounded-xl px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60 bg-[#3b82f6]"
        >
          {loading ? 'Loading…' : 'Refresh All'}
        </button>
      </div>

      {loading && (
        <div className="flex h-72 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#3b82f6] border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="mb-5 rounded-xl border p-4 text-sm font-medium bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
          {error} — configure credentials in <a href="/settings" className="underline">Settings</a>
        </div>
      )}

      {!loading && (
        <>
          {/* Global Date Filter */}
          <GlobalDateFilter 
            globalDateRange={globalDateRange} 
            onGlobalDateChange={handleGlobalDateChange}
          />

          {/* KPI Cards */}
          <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-4">
            <KpiCard title="Total Sessions" value={formatNumber(dashboard.totalSessions)} subtitle="nsess / session count" icon="📊" color="#3b82f6" />
            <KpiCard title="Total Traffic" value={formatBytes(dashboard.totalTraffic)} subtitle="nbytes total traffic" icon="🌐" color="#06b6d4" />
            <KpiCard title="High Risk Events" value={formatNumber(dashboard.highRiskEvents)} subtitle="Risk 4 + Risk 5" icon="🔴" color="#ef4444" />
            <KpiCard title="Top Destination" value={dashboard.topDestination} subtitle="" icon="🎯" color="#0f766e" />
            <KpiCard title="Security Score" value={`${dashboard.securityScore}/100`} subtitle={scoreStatus.label} icon="✅" color={scoreStatus.color} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {/* Risk Trend Over Time */}
            <ChartCard 
              title="Risk Trend Over Time" 
              subtitle="Bar = traffic bytes, Line = session count"
              dateRange={componentDateRanges.riskTrend}
              onDateChange={(newRange) => handleComponentDateChange('riskTrend', newRange)}
            >
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dashboard.riskTrendData} margin={{ top: 10, right: 25, bottom: 55, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                    <XAxis dataKey="date" angle={-35} textAnchor="end" height={75} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={formatBytes} />
                    <Tooltip formatter={(v, name) => name === 'traffic' ? [formatBytes(v), 'Traffic'] : [formatNumber(parseNumber(v)), 'Sessions']} />
                    <Bar yAxisId="right" dataKey="traffic" fill="#3b82f6" radius={[5, 5, 0, 0]} maxBarSize={42} />
                    <Line yAxisId="left" type="monotone" dataKey="sessions" stroke="#60a5fa" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Risk Distribution */}
            <ChartCard 
              title="Risk-wise Distribution" 
              subtitle="Risk 1 to Risk 5 security distribution"
              dateRange={componentDateRanges.riskDistribution}
              onDateChange={(newRange) => handleComponentDateChange('riskDistribution', newRange)}
            >
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dashboard.riskDistribution} dataKey="value" nameKey="name" outerRadius={115} label={{ fontSize: 11 }}>
                      {dashboard.riskDistribution.map((entry, i) => (
                        <Cell key={i} fill={RISK_COLORS[String(entry.risk)] || COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={v => formatNumber(parseNumber(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Top Attacks      */}
            <ChartCard 
              title="Top Attacks" 
              subtitle="Most repeated firewall threat / attack names"
              dateRange={componentDateRanges.topAttacks}
              onDateChange={(newRange) => handleComponentDateChange('topAttacks', newRange)}
            >
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.topAttacks} layout="vertical" margin={{ top: 10, right: 25, bottom: 10, left: 140 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 5, 5, 0]}>
                      {dashboard.topAttacks.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Top Sources */}
            <ChartCard 
              title="Top Sources" 
              subtitle="Highest source IP / source count"
              dateRange={componentDateRanges.topSources}
              onDateChange={(newRange) => handleComponentDateChange('topSources', newRange)}
            >
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.topSources} layout="vertical" margin={{ top: 10, right: 25, bottom: 10, left: 140 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 5, 5, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Top Denied Destinations */}
            <ChartCard 
              title="Top Denied Destinations" 
              subtitle="Denied destination systems"
              dateRange={componentDateRanges.topDeniedDestinations}
              onDateChange={(newRange) => handleComponentDateChange('topDeniedDestinations', newRange)}
            >
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.topDeniedDestinations} layout="vertical" margin={{ top: 10, right: 25, bottom: 10, left: 140 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#ef4444" radius={[0, 5, 5, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Top Connections */}
            <ChartCard 
              title="Top Connections" 
              subtitle="Most repeated firewall connections"
              dateRange={componentDateRanges.topConnections}
              onDateChange={(newRange) => handleComponentDateChange('topConnections', newRange)}
            >
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.topConnections} layout="vertical" margin={{ top: 10, right: 25, bottom: 10, left: 140 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#10b981" radius={[0, 5, 5, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}