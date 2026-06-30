import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import api from '../../api.js';

const COLORS = { CRITICAL: '#a855f7', HIGH: '#ef4444', MEDIUM: '#eab308', LOW: '#3b82f6', UNKNOWN: '#64748b' };
const tooltipStyle = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 12 };

function shortName(v) {
  return v?.length > 18 ? v.slice(0, 18) + '...' : (v || '');
}

function StatCard({ title, value, color }) {
  const cls = {
    default: 'text-[var(--foreground)]',
    red:     'text-red-500',
    yellow:  'text-yellow-500',
    purple:  'text-purple-500',
    blue:    'text-blue-500',
    green:   'text-green-500',
  };
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4 shadow-sm">
      <p className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-widest mb-1">{title}</p>
      <p className={`text-3xl font-bold ${cls[color] || cls.default}`}>{value}</p>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden shadow-sm">
      <div className="px-4 pt-4 pb-2">
        <p className="text-sm font-bold text-[var(--foreground)]">{title}</p>
      </div>
      {children}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-[var(--muted)] uppercase tracking-wider">{label}</span>
      <span className="text-xs font-semibold text-[var(--foreground)] mt-0.5">{value ?? '—'}</span>
    </div>
  );
}

function CustomRiskTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={tooltipStyle} className="p-2.5 text-xs space-y-0.5">
      <p className="font-bold text-[var(--foreground)]">{d.fullName || d.name}</p>
      <p className="text-[var(--muted)]">CVEs: <span className="font-semibold text-[var(--foreground)]">{d.cves}</span></p>
      {d.score != null && <p className="text-[var(--muted)]">Score: <span className="font-semibold text-[var(--foreground)]">{d.score}</span></p>}
    </div>
  );
}

export default function S1Cve() {
  const [apps, setApps]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    api.get('/sentinelone/db/application-cve')
      .then((r) => {
        setApps(r.data?.data || r.data?.cves || []);
        if (r.data?.lastSyncedAt) setLastSync(r.data.lastSyncedAt);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const dashboardData = useMemo(() => {
    // Raw records: one row per CVE per endpoint
    // Fields: cveId, applicationName, applicationVendor, severity, baseScore,
    //         daysDetected, endpointName, endpointId, detectionDate, status

    const sc = (r) => parseFloat(r.baseScore) || 0;

    // Aggregate per application
    const appMap = {};
    apps.forEach((r) => {
      const key = r.applicationName || r.application || 'Unknown';
      if (!appMap[key]) {
        appMap[key] = {
          name: key,
          vendor: r.applicationVendor || '',
          cves: new Set(),
          endpoints: new Set(),
          severities: [],
          scores: [],
          daysDetected: r.daysDetected || 0,
        };
      }
      const a = appMap[key];
      if (r.cveId) a.cves.add(r.cveId);
      if (r.endpointId || r.endpointName) a.endpoints.add(r.endpointId || r.endpointName);
      if (r.severity) a.severities.push((r.severity || '').toUpperCase());
      a.scores.push(sc(r));
      a.daysDetected = Math.max(a.daysDetected, r.daysDetected || 0);
    });

    const SEVER_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];
    const appList = Object.values(appMap).map((a) => ({
      name: a.name,
      vendor: a.vendor,
      cveCount: a.cves.size,
      endpointCount: a.endpoints.size,
      highestSeverity: SEVER_ORDER.find((s) => a.severities.includes(s)) || 'UNKNOWN',
      highestNvdBaseScore: a.scores.length ? Math.max(...a.scores) : 0,
      daysDetected: a.daysDetected,
    }));

    const totalApplications = appList.length;
    const totalCves         = new Set(apps.map((r) => r.cveId).filter(Boolean)).size || apps.length;
    const totalEndpoints    = new Set(apps.map((r) => r.endpointId || r.endpointName).filter(Boolean)).size;
    const avgScore          = apps.length > 0
      ? (apps.reduce((s, r) => s + sc(r), 0) / apps.length).toFixed(1)
      : 0;

    const severityMap = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };
    apps.forEach((r) => {
      const s = (r.severity || 'UNKNOWN').toUpperCase();
      if (s in severityMap) severityMap[s]++; else severityMap.UNKNOWN++;
    });
    const severityDistribution = Object.entries(severityMap)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value, fill: COLORS[name] }));

    const topRiskyApps = [...appList]
      .sort((a, b) => b.cveCount - a.cveCount)
      .slice(0, 10)
      .map((a) => ({ name: shortName(a.name), fullName: a.name, cves: a.cveCount, score: a.highestNvdBaseScore }));

    const agingBuckets = { '0-30': 0, '31-90': 0, '91-180': 0, '180+': 0 };
    apps.forEach((r) => {
      const d = parseInt(r.daysDetected, 10) || 0;
      if (d <= 30)  agingBuckets['0-30']++;
      else if (d <= 90)  agingBuckets['31-90']++;
      else if (d <= 180) agingBuckets['91-180']++;
      else agingBuckets['180+']++;
    });
    const cveAging = Object.entries(agingBuckets).map(([name, count]) => ({ name, count }));

    const endpointImpact = [...appList]
      .sort((a, b) => b.endpointCount - a.endpointCount)
      .slice(0, 10)
      .map((a) => ({ name: shortName(a.name), endpoints: a.endpointCount }));

    const scoreRangeBuckets = [
      { name: 'Low (0-3.9)',  fill: '#3b82f6', count: 0 },
      { name: 'Med (4-6.9)',  fill: '#eab308', count: 0 },
      { name: 'High (7-8.9)', fill: '#ef4444', count: 0 },
      { name: 'Crit (9-10)',  fill: '#a855f7', count: 0 },
    ];
    apps.forEach((r) => {
      const s = sc(r);
      if (s < 4)      scoreRangeBuckets[0].count++;
      else if (s < 7) scoreRangeBuckets[1].count++;
      else if (s < 9) scoreRangeBuckets[2].count++;
      else            scoreRangeBuckets[3].count++;
    });
    const scoreRange = scoreRangeBuckets.filter((b) => b.count > 0).map((b) => ({ name: b.name, value: b.count, fill: b.fill }));

    const vendorCounts = {};
    apps.forEach((r) => {
      const v = r.applicationVendor || '';
      if (v) vendorCounts[v] = (vendorCounts[v] || 0) + 1;
    });
    const vendorRisk = Object.entries(vendorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, cves]) => ({ name: shortName(name), cves, fullName: name }));

    const statusCounts = {};
    apps.forEach((r) => { const s = r.status || 'Unknown'; statusCounts[s] = (statusCounts[s] || 0) + 1; });
    const estimateStatus = Object.entries(statusCounts)
      .map(([name, value], i) => ({ name, value, fill: ['#f97316','#22c55e','#3b82f6','#a855f7'][i % 4] }));

    const criticalApps = appList
      .filter((a) => a.highestSeverity === 'CRITICAL')
      .sort((a, b) => b.cveCount - a.cveCount)
      .slice(0, 6);

    return {
      totalApplications, totalCves, totalEndpoints, avgScore,
      severityMap, severityDistribution, topRiskyApps,
      cveAging, endpointImpact, scoreRange, vendorRisk, estimateStatus, criticalApps,
    };
  }, [apps]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[300px] text-center">
        <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        </div>
        <p className="text-base font-semibold text-[var(--foreground)]">No CVE data</p>
        <p className="text-sm text-[var(--muted)] mt-1">Sync SentinelOne to populate CVE analytics</p>
      </div>
    );
  }

  const { totalApplications, totalCves, totalEndpoints, avgScore, severityMap,
          severityDistribution, topRiskyApps, cveAging, endpointImpact,
          scoreRange, vendorRisk, estimateStatus, criticalApps } = dashboardData;

  return (
    <div className="p-4 sm:p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">Application CVE Analytics</h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">
            {totalApplications} applications · {totalCves} CVE records
            {lastSync && <span> · Last sync: {new Date(lastSync).toLocaleString()}</span>}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        <StatCard title="Applications"  value={totalApplications}         color="default" />
        <StatCard title="Total CVEs"    value={totalCves}                 color="default" />
        <StatCard title="Critical Apps" value={severityMap.CRITICAL}      color="purple" />
        <StatCard title="High Apps"     value={severityMap.HIGH}          color="red" />
        <StatCard title="Medium Apps"   value={severityMap.MEDIUM}        color="yellow" />
        <StatCard title="Endpoints"     value={totalEndpoints}            color="blue" />
        <StatCard title="Avg Score"     value={avgScore}                  color="default" />
      </div>

      {/* Charts 2-col grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Severity Distribution donut */}
        <ChartCard title="Severity Distribution">
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={severityDistribution} innerRadius={65} outerRadius={95} dataKey="value" paddingAngle={3}>
                  {severityDistribution.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Base Score Range donut */}
        <ChartCard title="Base Score Range">
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={scoreRange} innerRadius={65} outerRadius={95} dataKey="value" paddingAngle={3}>
                  {scoreRange.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Top 10 Risky Applications */}
        <ChartCard title="Top 10 Risky Applications">
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topRiskyApps} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--muted)' }} angle={-25} textAnchor="end" />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} allowDecimals={false} />
                <Tooltip content={<CustomRiskTooltip />} />
                <Bar dataKey="cves" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={30} name="CVEs" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* CVE Aging */}
        <ChartCard title="CVE Aging (Days Detected)">
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cveAging} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 0, 0]} maxBarSize={50} name="Apps" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Endpoint Impact */}
        <ChartCard title="Endpoint Impact (Top 10)">
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={endpointImpact} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--muted)' }} angle={-25} textAnchor="end" />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="endpoints" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={30} name="Endpoints" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Vendor Risk */}
        <ChartCard title="Vendor Risk (CVEs by Vendor)">
          <div style={{ height: 300 }}>
            {vendorRisk.length === 0
              ? <div className="flex items-center justify-center h-full"><p className="text-sm text-[var(--muted)]">No vendor data</p></div>
              : <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vendorRisk} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted)' }} width={100} />
                    <XAxis type="number"   tick={{ fontSize: 10, fill: 'var(--muted)' }} allowDecimals={false} />
                    <Tooltip content={<CustomRiskTooltip />} />
                    <Bar dataKey="cves" fill="#f97316" radius={[0, 4, 4, 0]} maxBarSize={18} name="CVEs" />
                  </BarChart>
                </ResponsiveContainer>
            }
          </div>
        </ChartCard>

      </div>

      {/* Critical Apps mini-cards */}
      {criticalApps.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-[var(--foreground)] mb-3">Critical Applications</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {criticalApps.map((app, i) => (
              <div key={i} className="bg-[var(--card-bg)] border-l-4 border-purple-500 border border-[var(--card-border)] rounded-xl p-4 shadow-sm">
                <p className="text-sm font-bold text-[var(--foreground)] truncate mb-3" title={app.name}>{app.name}</p>
                <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                  <Info label="Severity"  value={<span className="text-purple-600 font-bold">{app.highestSeverity}</span>} />
                  <Info label="CVEs"      value={app.cveCount} />
                  <Info label="Score"     value={typeof app.highestNvdBaseScore === 'number' ? app.highestNvdBaseScore.toFixed(1) : app.highestNvdBaseScore} />
                  <Info label="Endpoints" value={app.endpointCount} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
