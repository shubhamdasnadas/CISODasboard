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

// ── Helpers ───────────────────────────────────────────────────────────────────

const parseNumber = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(String(v).replace(/,/g, '').replace(/[^\d.-]/g, '').trim());
  return Number.isFinite(n) ? n : 0;
};

const formatNumber = (v) => Number(v || 0).toLocaleString('en-IN');

const formatBytes = (v) => {
  const b = parseNumber(v);
  if (b >= 1e12) return `${(b / 1e12).toFixed(2)} TB`;
  if (b >= 1e9)  return `${(b / 1e9).toFixed(2)} GB`;
  if (b >= 1e6)  return `${(b / 1e6).toFixed(2)} MB`;
  if (b >= 1e3)  return `${(b / 1e3).toFixed(2)} KB`;
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
          Object.keys(item).forEach(k => {
            if (k === '@name') colSet.add('name');
            else if (!k.startsWith('@')) colSet.add(k);
          });
      });
      const columns = Array.from(colSet);
      const rows = entry.map(item => {
        const row = {};
        columns.forEach(col => {
          const rk = col === 'name' ? '@name' : col;
          const value = item?.[rk] ?? item?.[col];
          row[col] = typeof value === 'object' && value !== null && '#text' in value
            ? value['#text']
            : value ?? '';
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

const DATE_COLS = ['slabbed-receive_time', 'receive_time', 'time_generated', 'time', 'date', 'updatedAt'];

const getRowDate = (row) => {
  const raw = getFirstValue(row, DATE_COLS, null);
  if (!raw || raw === '-') return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
};

const filterRowsByDate = (rows, from, to) => {
  if (!from && !to) return rows;
  // Check if ANY row in this dataset has a date column
  const hasDateCol = rows.some(row => getRowDate(row) !== null);
  // If no date column exists in data, return all rows unfiltered
  if (!hasDateCol) return rows;
  return rows.filter(row => {
    const d = getRowDate(row);
    // Row has no date — exclude it when a filter is active
    if (!d) return false;
    const key = d.toISOString().slice(0, 10);
    if (from && key < from) return false;
    if (to   && key > to)   return false;
    return true;
  });
};

const makeTopChartData = (rows, cols, limit = 8) => {
  const map = new Map();
  rows.forEach(row => {
    const value = String(getFirstValue(row, cols, '')).trim();
    if (!value || value === '-') return;
    const rawCount = getFirstValue(row, ['count','nrepeat','nsess','sessions','threats','nbytes','bytes'], null);
    const n = rawCount !== null ? parseNumber(rawCount) : 1;
    map.set(value, (map.get(value) || 0) + (n > 0 ? n : 1));
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
    old.traffic  += parseNumber(getFirstValue(row, ['nbytes','bytes','byte'], 0));
    map.set(date, old);
  });
  return Array.from(map.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
};

const makeRiskDistribution = (rows) => {
  const map = new Map();
  rows.forEach(row => {
    const risk  = String(getFirstValue(row, ['risk','severity','name'], '-'));
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
  if (score >= 70) return { label: 'Warning',   color: '#f59e0b' };
  return { label: 'Critical', color: '#ef4444' };
};

// ── Reusable Components ───────────────────────────────────────────────────────

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

function useCardFilter(rows) {
  const [from, setFrom] = useState('');
  const [to, setTo]     = useState('');
  const filtered = useMemo(() => filterRowsByDate(rows, from, to), [rows, from, to]);
  const clear = () => { setFrom(''); setTo(''); };
  return { from, to, setFrom, setTo, clear, filtered };
}

function ChartCard({ title, subtitle, controls, children }) {
  return (
    <div className="rounded-2xl border p-4 sm:p-5 bg-[var(--card-bg)] border-[var(--card-border)]">
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-extrabold sm:text-lg text-[var(--foreground)]">{title}</h3>
          {subtitle && <p className="text-sm text-[var(--muted)] mt-0.5">{subtitle}</p>}
        </div>
        {controls && <div className="flex items-center gap-2">{controls}</div>}
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
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  const fetchAllReports = async () => {
    setLoading(true);
    setError('');
    try {
      const params = buildQueryParams(globalDateRange);
      const queryString = params ? `?${params}` : '';
      
      const results = await Promise.allSettled(
        REPORTS_TO_FETCH.map(name =>
          api.get(`/firewall/reports/${name}`).then(r => {
            const raw   = r.data?.data ?? r.data;
            const table = extractTable(raw);
            return { report: name, rows: table?.rows ?? [], columns: table?.columns ?? [] };
          })
        )
      );
      setAllReports(results.filter(r => r.status === 'fulfilled').map(r => r.value));
    } catch (e) {
      setError(e.message || 'Failed to fetch firewall reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAllReports(); }, []);

  // Raw rows per report (no global filter)
  const riskRows        = useMemo(() => getRowsByReport(allReports, 'risk-trend'), [allReports]);
  const attackSrcRows   = useMemo(() => getRowsByReport(allReports, 'top-attacker-sources'), [allReports]);
  const attackDestRows  = useMemo(() => getRowsByReport(allReports, 'top-attacker-destinations'), [allReports]);
  const deniedRows      = useMemo(() => [
    ...getRowsByReport(allReports, 'top-denied-destinations'),
    ...getRowsByReport(allReports, 'top-denied-sources'),
    ...getRowsByReport(allReports, 'top-denied-applications'),
  ], [allReports]);
  const riskyUserRows   = useMemo(() => getRowsByReport(allReports, 'risky-users'), [allReports]);
  const topAttackRows   = useMemo(() => getRowsByReport(allReports, 'top-attacks'), [allReports]);
  const connectionRows  = useMemo(() => getRowsByReport(allReports, 'top-connections'), [allReports]);
  const allRows         = useMemo(() => allReports.flatMap(r => r.rows), [allReports]);

  // Single shared date filter for all KPI cards
  const [kpiFrom, setKpiFrom] = useState('');
  const [kpiTo,   setKpiTo]   = useState('');

  const kpiRows = useMemo(() => filterRowsByDate(allRows, kpiFrom, kpiTo), [allRows, kpiFrom, kpiTo]);
  const kpiRiskRows   = useMemo(() => filterRowsByDate(riskRows,    kpiFrom, kpiTo), [riskRows,    kpiFrom, kpiTo]);
  const kpiDeniedRows = useMemo(() => filterRowsByDate(deniedRows,  kpiFrom, kpiTo), [deniedRows,  kpiFrom, kpiTo]);
  const kpiDestRows   = useMemo(() => filterRowsByDate(attackDestRows, kpiFrom, kpiTo), [attackDestRows, kpiFrom, kpiTo]);
  const kpiRiskyRows  = useMemo(() => filterRowsByDate(riskyUserRows,  kpiFrom, kpiTo), [riskyUserRows,  kpiFrom, kpiTo]);

  // Per-card filters
  const riskTrendFilter   = useCardFilter(riskRows);
  const riskDistFilter    = useCardFilter(riskRows);
  const topAttacksFilter  = useCardFilter(topAttackRows);
  const topSourcesFilter  = useCardFilter(attackSrcRows);
  const deniedFilter      = useCardFilter(deniedRows);
  const connectionsFilter = useCardFilter(connectionRows);

  // KPI values — filtered by shared KPI date filter
  const kpis = useMemo(() => {
    const totalSessions  = getSumByColumn(kpiRows, ['nsess','sessions','session','count']);
    const totalTraffic   = getSumByColumn(kpiRows, ['nbytes','bytes','byte']);
    const highRiskEvents = kpiRiskRows.reduce((sum, row) => {
      const risk = parseNumber(getFirstValue(row, ['risk','name','severity'], 0));
      return risk >= 4 ? sum + parseNumber(getFirstValue(row, ['count','nrepeat','nsess','sessions'], 1)) : sum;
    }, 0);
    const blockedConnections = kpiDeniedRows.length || kpiRows.filter(row => {
      const action = String(getFirstValue(row, ['action','category','name'], '')).toLowerCase();
      return action.includes('block') || action.includes('deny') || action.includes('drop');
    }).length;
    const topDestination = makeTopChartData(
      kpiDestRows.length ? kpiDestRows : kpiRows,
      ['dst','destination','destination_ip','name']
    )[0]?.name || '-';
    const securityScore = Math.max(0, Math.min(100,
      Math.round(100 - highRiskEvents * 0.05 - kpiRiskyRows.length * 2 - blockedConnections * 0.1)
    ));
    return { totalSessions, totalTraffic, highRiskEvents, topDestination, securityScore };
  }, [kpiRows, kpiRiskRows, kpiDeniedRows, kpiDestRows, kpiRiskyRows]);

  // Per-card chart data
  const riskTrendData   = useMemo(() => makeRiskTrendData(riskTrendFilter.filtered), [riskTrendFilter.filtered]);
  const riskDistData    = useMemo(() => makeRiskDistribution(riskDistFilter.filtered), [riskDistFilter.filtered]);
  const isActive = (f) => !!(f.from || f.to);
  const topAttacksData  = useMemo(() => makeTopChartData(isActive(topAttacksFilter) ? topAttacksFilter.filtered : topAttackRows, ['threatid','threat','name','category']), [topAttacksFilter.filtered, topAttacksFilter.from, topAttacksFilter.to, topAttackRows]);
  const topSourcesData  = useMemo(() => makeTopChartData(isActive(topSourcesFilter) ? topSourcesFilter.filtered : attackSrcRows, ['src','source','source_ip','name']), [topSourcesFilter.filtered, topSourcesFilter.from, topSourcesFilter.to, attackSrcRows]);
  const deniedDestData  = useMemo(() => {
    const rows = isActive(deniedFilter) ? deniedFilter.filtered : deniedRows;
    // Try all possible column names used across top-denied-destinations / sources / applications
    const data = makeTopChartData(rows, ['dst','destination','destination_ip','app','application','name','category']);
    // If still empty, render raw name column as-is
    if (data.length === 0) {
      return makeTopChartData(rows, Object.keys(rows[0] || {}));
    }
    return data;
  }, [deniedFilter.filtered, deniedRows]);
  const connectionsData = useMemo(() => makeTopChartData(isActive(connectionsFilter) ? connectionsFilter.filtered : connectionRows, ['name','src','source','dst','destination']), [connectionsFilter.filtered, connectionsFilter.from, connectionsFilter.to, connectionRows]);

  const scoreStatus = getSecurityScoreStatus(kpis.securityScore);

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

      {/* Loader */}
      {loading && (
        <div className="flex h-72 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#3b82f6] border-t-transparent" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-5 rounded-xl border p-4 text-sm font-medium bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
          {error} — configure credentials in <a href="/settings" className="underline">Settings</a>
        </div>
      )}

      {!loading && (
        <>
          {/* KPI Date Filter */}
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wide">KPI Filter:</span>
            <input type="date" value={kpiFrom} max={kpiTo || undefined}
              onChange={(e) => setKpiFrom(e.target.value)}
              className="text-[11px] px-2 py-1 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <span className="text-[11px] text-[var(--muted)]">→</span>
            <input type="date" value={kpiTo} min={kpiFrom || undefined}
              onChange={(e) => setKpiTo(e.target.value)}
              className="text-[11px] px-2 py-1 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            {(kpiFrom || kpiTo) && (
              <button onClick={() => { setKpiFrom(''); setKpiTo(''); }}
                className="text-[11px] text-indigo-500 hover:text-indigo-700 font-semibold">Clear</button>
            )}
          </div>

          {/* KPI Cards */}
          <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-4">
            <KpiCard title="Total Sessions"  value={formatNumber(kpis.totalSessions)}      subtitle="nsess / session count"   icon="📊" color="#3b82f6" />
            <KpiCard title="Total Traffic"   value={formatBytes(kpis.totalTraffic)}         subtitle="nbytes total traffic"    icon="🌐" color="#06b6d4" />
            <KpiCard title="High Risk Events" value={formatNumber(kpis.highRiskEvents)}     subtitle="Risk 4 + Risk 5"         icon="🔴" color="#ef4444" />
            <KpiCard title="Top Destination" value={kpis.topDestination}                    subtitle=""                        icon="🎯" color="#0f766e" />
            <KpiCard title="Security Score"  value={`${kpis.securityScore}/100`}            subtitle={scoreStatus.label}       icon="✅" color={scoreStatus.color} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

            {/* Risk Trend */}
            <ChartCard
              title="Risk Trend Over Time"
              subtitle="Bar = traffic bytes, Line = session count"
              controls={<DateFilter from={riskTrendFilter.from} to={riskTrendFilter.to} onFromChange={riskTrendFilter.setFrom} onToChange={riskTrendFilter.setTo} onClear={riskTrendFilter.clear} />}
            >
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={riskTrendData} margin={{ top: 10, right: 25, bottom: 55, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                    <XAxis dataKey="date" angle={-35} textAnchor="end" height={75} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left"  tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={formatBytes} />
                    <Tooltip formatter={(v, name) => name === 'traffic' ? [formatBytes(v), 'Traffic'] : [formatNumber(parseNumber(v)), 'Sessions']} />
                    <Bar  yAxisId="right" dataKey="traffic"  fill="#3b82f6" radius={[5,5,0,0]} maxBarSize={42} />
                    <Line yAxisId="left"  type="monotone" dataKey="sessions" stroke="#60a5fa" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Risk Distribution */}
            <ChartCard
              title="Risk-wise Distribution"
              subtitle="Risk 1 to Risk 5 security distribution"
              controls={<DateFilter from={riskDistFilter.from} to={riskDistFilter.to} onFromChange={riskDistFilter.setFrom} onToChange={riskDistFilter.setTo} onClear={riskDistFilter.clear} />}
            >
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={riskDistData} dataKey="value" nameKey="name" outerRadius={115} label={{ fontSize: 11 }}>
                      {riskDistData.map((entry, i) => (
                        <Cell key={i} fill={RISK_COLORS[String(entry.risk)] || COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={v => formatNumber(parseNumber(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Top Attacks */}
            <ChartCard
              title="Top Attacks"
              subtitle="Most repeated firewall threat / attack names"
              controls={<DateFilter from={topAttacksFilter.from} to={topAttacksFilter.to} onFromChange={topAttacksFilter.setFrom} onToChange={topAttacksFilter.setTo} onClear={topAttacksFilter.clear} />}
            >
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topAttacksData} layout="vertical" margin={{ top: 10, right: 25, bottom: 10, left: 140 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0,5,5,0]}>
                      {topAttacksData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Top Sources */}
            <ChartCard
              title="Top Sources"
              subtitle="Highest source IP / source count"
              controls={<DateFilter from={topSourcesFilter.from} to={topSourcesFilter.to} onFromChange={topSourcesFilter.setFrom} onToChange={topSourcesFilter.setTo} onClear={topSourcesFilter.clear} />}
            >
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topSourcesData} layout="vertical" margin={{ top: 10, right: 25, bottom: 10, left: 140 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" radius={[0,5,5,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Top Denied Destinations */}
            <ChartCard
              title="Top Denied Destinations"
              subtitle="Denied destination systems"
              controls={<DateFilter from={deniedFilter.from} to={deniedFilter.to} onFromChange={deniedFilter.setFrom} onToChange={deniedFilter.setTo} onClear={deniedFilter.clear} />}
            >
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deniedDestData} layout="vertical" margin={{ top: 10, right: 25, bottom: 10, left: 140 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#ef4444" radius={[0,5,5,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Top Connections */}
            <ChartCard
              title="Top Connections"
              subtitle="Most repeated firewall connections"
              controls={<DateFilter from={connectionsFilter.from} to={connectionsFilter.to} onFromChange={connectionsFilter.setFrom} onToChange={connectionsFilter.setTo} onClear={connectionsFilter.clear} />}
            >
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={connectionsData} layout="vertical" margin={{ top: 10, right: 25, bottom: 10, left: 140 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#10b981" radius={[0,5,5,0]} />
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