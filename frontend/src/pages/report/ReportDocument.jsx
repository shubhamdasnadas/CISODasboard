import { useMemo } from 'react';
import {
  PieChart, Pie, Cell,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

// ── Colours ──────────────────────────────────────────────────────────────────
const COLORS      = ['#3b82f6','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];
const SEV_COLORS  = ['#22c55e','#84cc16','#f59e0b','#f97316','#ef4444'];
const STATE_COLORS = { new:'#ef4444', pending:'#f97316', detected:'#f59e0b', remediated:'#22c55e', closed:'#3b82f6', done:'#10b981' };

// ── Firewall data helpers (mirrored from PaloAltoPage.jsx) ──────────────────
const toArray = (v) => {
  if (Array.isArray(v) && v.length > 0) return v;
  if (v && typeof v === 'object' && !Array.isArray(v)) return [v];
  return undefined;
};

const parseNumber = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(String(v).replace(/,/g, '').replace(/[^\d.-]/g, '').trim());
  return Number.isFinite(n) ? n : 0;
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
  } catch (_) { /* ignore */ }
  return null;
};

const getFirstValue = (row, cols, fallback = '-') => {
  for (const col of cols) {
    const v = row?.[col];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return fallback;
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
    .map(([name, value]) => ({ name: name.length > 30 ? name.slice(0, 30) + '…' : name, value }));
};

const makeRiskTrendData = (rows) => {
  const map = new Map();
  rows.forEach(row => {
    const rawDate = getFirstValue(row, ['slabbed-receive_time','receive_time','time','date','updatedAt']);
    const date = rawDate && rawDate !== '-' ? new Date(rawDate).toLocaleDateString('en-CA') : null;
    if (!date || date === 'Invalid Date') return;
    const old = map.get(date) || { date, sessions: 0 };
    old.sessions += parseNumber(getFirstValue(row, ['nsess','sessions','session','count'], 1));
    map.set(date, old);
  });
  return Array.from(map.values()).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-14);
};

// ── Layout primitives ─────────────────────────────────────────────────────────
const TT_STYLE = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 11 };

function SectionHeader({ number, title, color = '#4f46e5' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, marginTop: 8 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6, background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0,
      }}>{number}</div>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827', borderBottom: `2px solid ${color}`, paddingBottom: 4, flex: 1 }}>{title}</h2>
    </div>
  );
}

function KpiCard({ label, value, sub, color = '#4f46e5' }) {
  return (
    <div style={{
      background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10,
      padding: '14px 18px', flex: '1 1 0', minWidth: 120,
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
      overflow: 'hidden', flex: '1 1 0', minWidth: 0,
    }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#374151' }}>{title}</p>
      </div>
      <div style={{ padding: '12px 8px' }}>{children}</div>
    </div>
  );
}

function DataTable({ columns, rows, maxRows = 8 }) {
  if (!rows || rows.length === 0) {
    return <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', padding: '12px 0' }}>No data available</p>;
  }
  const displayRows = rows.slice(0, maxRows);
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
      <thead>
        <tr style={{ background: '#f9fafb' }}>
          {columns.map(col => (
            <th key={col} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb' }}>
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {displayRows.map((row, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
            {columns.map(col => (
              <td key={col} style={{ padding: '5px 10px', color: '#374151', borderBottom: '1px solid #f3f4f6', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {String(row[col] ?? '-')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function NoData() {
  return <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>No data available</p>;
}

// ── Section 1: Cover Page ─────────────────────────────────────────────────────
function CoverPage({ orgName, generatedAt }) {
  const dateStr = new Date(generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div style={{ background: '#1e1b4b', minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 40px', textAlign: 'center', borderRadius: 0 }}>
      {/* Shield icon */}
      <div style={{ width: 72, height: 72, background: '#4f46e5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      </div>
      <h1 style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>CISO Security Report</h1>
      <p style={{ margin: '0 0 32px', fontSize: 16, color: '#a5b4fc' }}>{orgName}</p>
      <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '12px 24px' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#c7d2fe' }}>Generated {dateStr}</p>
      </div>
      <div style={{ marginTop: 48, display: 'flex', gap: 24 }}>
        {['Checkpoint Harmony', 'SentinelOne', 'Palo Alto Firewall'].map(t => (
          <div key={t} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 16px' }}>
            <p style={{ margin: 0, fontSize: 11, color: '#a5b4fc', fontWeight: 600 }}>{t}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section 2: Executive Summary ──────────────────────────────────────────────
function ExecutiveSummary({ s1Threats, s1Agents, harmonyEvents }) {
  const totalThreats   = Array.isArray(s1Threats) ? s1Threats.length : 0;
  const activeAgents   = Array.isArray(s1Agents)  ? s1Agents.filter(a => (a.network_status || a.networkStatus || '').toLowerCase() === 'connected').length : 0;
  const totalAgents    = Array.isArray(s1Agents)  ? s1Agents.length : 0;
  const cpEvents       = Array.isArray(harmonyEvents) ? harmonyEvents.length : 0;
  const criticalThreats = Array.isArray(s1Threats) ? s1Threats.filter(t => (t.severity || '').toLowerCase() === 'critical' || Number(t.classification_source_id) >= 4).length : 0;

  return (
    <div style={{ padding: '24px 32px', background: '#fff' }}>
      <SectionHeader number="1" title="Executive Summary" color="#4f46e5" />
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <KpiCard label="Total Threats" value={totalThreats} sub="SentinelOne detections" color="#ef4444" />
        <KpiCard label="Critical Threats" value={criticalThreats} sub="High severity" color="#f97316" />
        <KpiCard label="Active Agents" value={`${activeAgents}/${totalAgents}`} sub="Endpoints connected" color="#10b981" />
        <KpiCard label="Harmony Events" value={cpEvents} sub="Checkpoint detections" color="#4f46e5" />
      </div>
      <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 16px' }}>
        <p style={{ margin: 0, fontSize: 12, color: '#166534' }}>
          <strong>Report Period:</strong> This report covers all security events currently synced to the CISO Dashboard across all integrated platforms.
          {totalThreats === 0 && cpEvents === 0 ? ' No threats detected across all platforms.' : ` ${totalThreats} endpoint threat${totalThreats !== 1 ? 's' : ''} and ${cpEvents} email security event${cpEvents !== 1 ? 's' : ''} detected.`}
        </p>
      </div>
    </div>
  );
}

// ── Section 3: Checkpoint Harmony ────────────────────────────────────────────
function CheckpointSection({ harmonyEvents }) {
  const events = Array.isArray(harmonyEvents) ? harmonyEvents : [];

  const severityData = useMemo(() => {
    const counts = {};
    events.forEach(e => { const s = e.severity ?? 'Unknown'; counts[s] = (counts[s] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [events]);

  const stateData = useMemo(() => {
    const counts = {};
    events.forEach(e => { const s = e.state ?? 'unknown'; counts[s] = (counts[s] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [events]);

  const typeData = useMemo(() => {
    const counts = {};
    events.forEach(e => { const t = e.type ?? 'Unknown'; counts[t] = (counts[t] || 0) + 1; });
    return Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,8).map(([name, value]) => ({ name: name.length > 22 ? name.slice(0,22)+'…' : name, value }));
  }, [events]);

  return (
    <div style={{ padding: '24px 32px', background: '#fff', borderTop: '1px solid #f3f4f6' }}>
      <SectionHeader number="2" title="Checkpoint Harmony — Email & Cloud Security" color="#2563eb" />
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <KpiCard label="Total Events" value={events.length} sub="All event types" color="#2563eb" />
        <KpiCard label="Pending Actions" value={events.filter(e => e.state === 'pending').length} sub="Require attention" color="#f59e0b" />
        <KpiCard label="Remediated" value={events.filter(e => ['remediated','done','closed'].includes(e.state)).length} sub="Resolved events" color="#10b981" />
      </div>

      {events.length === 0 ? <NoData /> : (
        <div style={{ display: 'flex', gap: 12 }}>
          <ChartCard title="Severity Distribution">
            <PieChart width={230} height={200}>
              <Pie data={severityData} cx={110} cy={90} innerRadius={50} outerRadius={78} paddingAngle={2} dataKey="value">
                {severityData.map((_, i) => <Cell key={i} fill={SEV_COLORS[i % SEV_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={TT_STYLE} />
              <Legend iconSize={9} wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ChartCard>

          <ChartCard title="Event State Breakdown">
            <PieChart width={230} height={200}>
              <Pie data={stateData} cx={110} cy={90} innerRadius={50} outerRadius={78} paddingAngle={2} dataKey="value">
                {stateData.map((d, i) => <Cell key={i} fill={STATE_COLORS[d.name] ?? COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={TT_STYLE} />
              <Legend iconSize={9} wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ChartCard>

          <ChartCard title="Top Event Types">
            {typeData.length === 0 ? <NoData /> : (
              <BarChart width={230} height={200} data={typeData} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis type="number" tick={{ fontSize: 9 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={90} />
                <Tooltip contentStyle={TT_STYLE} />
                <Bar dataKey="value" fill="#3b82f6" radius={[0,3,3,0]} />
              </BarChart>
            )}
          </ChartCard>
        </div>
      )}

      {events.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Recent Events (Top 10)</p>
          <DataTable
            columns={['type', 'state', 'severity', 'description', 'sender_address']}
            rows={events.slice(0, 10).map(e => ({
              type: e.type || '-',
              state: e.state || '-',
              severity: e.severity || '-',
              description: (e.description || '').slice(0, 50) || '-',
              sender_address: e.sender_address || '-',
            }))}
          />
        </div>
      )}
    </div>
  );
}

// ── Section 4: SentinelOne Threats ────────────────────────────────────────────
function S1ThreatsSection({ s1Threats }) {
  const threats = Array.isArray(s1Threats) ? s1Threats : [];

  const mitigationData = useMemo(() => {
    const counts = {};
    threats.forEach(t => { const m = t.mitigation_status || t.mitigationStatus || 'unknown'; counts[m] = (counts[m]||0)+1; });
    return Object.entries(counts).map(([name,value]) => ({ name: name.length > 18 ? name.slice(0,18)+'…' : name, value }));
  }, [threats]);

  const severityData = useMemo(() => {
    const counts = {};
    threats.forEach(t => { const s = t.severity || 'Unknown'; counts[s] = (counts[s]||0)+1; });
    return Object.entries(counts).map(([name,value]) => ({ name, value }));
  }, [threats]);

  const classData = useMemo(() => {
    const counts = {};
    threats.forEach(t => { const c = t.classification || t.threat_classification_name || 'Unknown'; counts[c] = (counts[c]||0)+1; });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([name,value]) => ({ name: name.length > 20 ? name.slice(0,20)+'…':name, value }));
  }, [threats]);

  return (
    <div style={{ padding: '24px 32px', background: '#fff', borderTop: '1px solid #f3f4f6' }}>
      <SectionHeader number="3" title="SentinelOne — Threat Analytics" color="#ef4444" />
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <KpiCard label="Total Threats" value={threats.length} color="#ef4444" />
        <KpiCard label="Mitigated" value={threats.filter(t => ['mitigated','killed','remediated'].includes((t.mitigation_status||t.mitigationStatus||'').toLowerCase())).length} color="#10b981" />
        <KpiCard label="Pending" value={threats.filter(t => ['pending','not_mitigated'].includes((t.mitigation_status||t.mitigationStatus||'').toLowerCase())).length} color="#f59e0b" />
      </div>

      {threats.length === 0 ? <NoData /> : (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <ChartCard title="Mitigation Status">
            {mitigationData.length === 0 ? <NoData /> : (
              <BarChart width={230} height={200} data={mitigationData} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis type="number" tick={{ fontSize: 9 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={90} />
                <Tooltip contentStyle={TT_STYLE} />
                <Bar dataKey="value" fill="#ef4444" radius={[0,3,3,0]} />
              </BarChart>
            )}
          </ChartCard>

          <ChartCard title="Severity Distribution">
            <PieChart width={230} height={200}>
              <Pie data={severityData} cx={110} cy={90} innerRadius={50} outerRadius={78} paddingAngle={2} dataKey="value">
                {severityData.map((_, i) => <Cell key={i} fill={SEV_COLORS[i % SEV_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={TT_STYLE} />
              <Legend iconSize={9} wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ChartCard>

          <ChartCard title="Classification">
            {classData.length === 0 ? <NoData /> : (
              <BarChart width={230} height={200} data={classData} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis type="number" tick={{ fontSize: 9 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={90} />
                <Tooltip contentStyle={TT_STYLE} />
                <Bar dataKey="value" fill="#f97316" radius={[0,3,3,0]} />
              </BarChart>
            )}
          </ChartCard>
        </div>
      )}

      {threats.length > 0 && (
        <DataTable
          columns={['threat_name', 'severity', 'mitigation_status', 'classification', 'created_at']}
          rows={threats.slice(0, 10).map(t => ({
            threat_name: (t.threat_name || t.threatName || '-').slice(0, 40),
            severity: t.severity || '-',
            mitigation_status: t.mitigation_status || t.mitigationStatus || '-',
            classification: (t.classification || t.threat_classification_name || '-').slice(0, 30),
            created_at: t.created_at ? new Date(t.created_at).toLocaleDateString() : '-',
          }))}
        />
      )}
    </div>
  );
}

// ── Section 5: SentinelOne Agents ─────────────────────────────────────────────
function S1AgentsSection({ s1Agents }) {
  const agents = Array.isArray(s1Agents) ? s1Agents : [];

  const statusData = useMemo(() => {
    const counts = {};
    agents.forEach(a => { const s = a.network_status || a.networkStatus || 'unknown'; counts[s] = (counts[s]||0)+1; });
    return Object.entries(counts).map(([name,value]) => ({ name, value }));
  }, [agents]);

  const osData = useMemo(() => {
    const counts = {};
    agents.forEach(a => { const s = a.os_type || a.osType || a.os || 'Unknown'; counts[s] = (counts[s]||0)+1; });
    return Object.entries(counts).map(([name,value]) => ({ name, value }));
  }, [agents]);

  return (
    <div style={{ padding: '24px 32px', background: '#fff', borderTop: '1px solid #f3f4f6' }}>
      <SectionHeader number="4" title="SentinelOne — Agent Analytics" color="#10b981" />
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <KpiCard label="Total Agents" value={agents.length} color="#10b981" />
        <KpiCard label="Connected" value={agents.filter(a=>(a.network_status||a.networkStatus||'').toLowerCase()==='connected').length} color="#22c55e" />
        <KpiCard label="Disconnected" value={agents.filter(a=>(a.network_status||a.networkStatus||'').toLowerCase()==='disconnected').length} color="#ef4444" />
      </div>

      {agents.length === 0 ? <NoData /> : (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <ChartCard title="Agent Network Status">
            <PieChart width={270} height={200}>
              <Pie data={statusData} cx={130} cy={90} innerRadius={55} outerRadius={82} paddingAngle={2} dataKey="value">
                {statusData.map((d,i) => <Cell key={i} fill={d.name==='connected'?'#22c55e':d.name==='disconnected'?'#ef4444':COLORS[i%COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={TT_STYLE} />
              <Legend iconSize={9} wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ChartCard>

          <ChartCard title="OS Distribution">
            <PieChart width={270} height={200}>
              <Pie data={osData} cx={130} cy={90} innerRadius={55} outerRadius={82} paddingAngle={2} dataKey="value">
                {osData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={TT_STYLE} />
              <Legend iconSize={9} wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ChartCard>
        </div>
      )}

      {agents.length > 0 && (
        <DataTable
          columns={['computer_name', 'os_type', 'network_status', 'agent_version', 'last_active_date']}
          rows={agents.slice(0, 10).map(a => ({
            computer_name: a.computer_name || a.computerName || '-',
            os_type: a.os_type || a.osType || a.os || '-',
            network_status: a.network_status || a.networkStatus || '-',
            agent_version: a.agent_version || a.agentVersion || '-',
            last_active_date: a.last_active_date ? new Date(a.last_active_date).toLocaleDateString() : '-',
          }))}
        />
      )}
    </div>
  );
}

// ── Section 6: SentinelOne CVEs ───────────────────────────────────────────────
function S1CveSection({ s1Cves }) {
  const cves = Array.isArray(s1Cves) ? s1Cves : [];

  const severityData = useMemo(() => {
    const counts = {};
    cves.forEach(c => { const s = c.severity || c.nist_severity || 'Unknown'; counts[s] = (counts[s]||0)+1; });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([name,value]) => ({ name, value }));
  }, [cves]);

  return (
    <div style={{ padding: '24px 32px', background: '#fff', borderTop: '1px solid #f3f4f6' }}>
      <SectionHeader number="5" title="SentinelOne — Application CVEs" color="#8b5cf6" />
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <KpiCard label="Total CVEs" value={cves.length} color="#8b5cf6" />
        <KpiCard label="Critical" value={cves.filter(c=>(c.severity||c.nist_severity||'').toLowerCase()==='critical').length} color="#ef4444" />
        <KpiCard label="High" value={cves.filter(c=>(c.severity||c.nist_severity||'').toLowerCase()==='high').length} color="#f97316" />
      </div>

      {cves.length === 0 ? <NoData /> : (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <ChartCard title="CVE Severity Breakdown">
            <BarChart width={350} height={200} data={severityData} margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={TT_STYLE} />
              <Bar dataKey="value" fill="#8b5cf6" radius={[3,3,0,0]} />
            </BarChart>
          </ChartCard>
        </div>
      )}

      {cves.length > 0 && (
        <DataTable
          columns={['cve_id', 'application_name', 'severity', 'cvss_score', 'published_date']}
          rows={cves.slice(0, 10).map(c => ({
            cve_id: c.cve_id || c.cveId || c.id || '-',
            application_name: (c.application_name || c.applicationName || c.app_name || '-').slice(0, 30),
            severity: c.severity || c.nist_severity || '-',
            cvss_score: c.cvss_score ?? c.cvssScore ?? '-',
            published_date: c.published_date ? new Date(c.published_date).toLocaleDateString() : '-',
          }))}
        />
      )}
    </div>
  );
}

// ── Section 7: Palo Alto Firewall ─────────────────────────────────────────────
function FirewallSection({ fwRiskRaw, fwAttackersRaw, fwConnectionsRaw }) {
  const riskTable      = useMemo(() => extractTable(fwRiskRaw), [fwRiskRaw]);
  const attackersTable = useMemo(() => extractTable(fwAttackersRaw), [fwAttackersRaw]);
  const connTable      = useMemo(() => extractTable(fwConnectionsRaw), [fwConnectionsRaw]);

  const riskTrend = useMemo(() => riskTable ? makeRiskTrendData(riskTable.rows) : [], [riskTable]);
  const topAttackers = useMemo(() => attackersTable
    ? makeTopChartData(attackersTable.rows, ['from','source','src','attacker','name'])
    : [], [attackersTable]);

  const hasAnyData = riskTrend.length > 0 || topAttackers.length > 0 || (connTable?.rows?.length ?? 0) > 0;

  return (
    <div style={{ padding: '24px 32px', background: '#fff', borderTop: '1px solid #f3f4f6' }}>
      <SectionHeader number="6" title="Palo Alto Firewall — Network Security" color="#f97316" />

      {!hasAnyData ? <NoData /> : (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            {riskTrend.length > 0 && (
              <ChartCard title="Risk / Session Trend">
                <LineChart width={340} height={200} data={riskTrend} margin={{ left: 4, right: 16, top: 4, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 8 }} angle={-30} textAnchor="end" />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={TT_STYLE} />
                  <Line type="monotone" dataKey="sessions" stroke="#f97316" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartCard>
            )}
            {topAttackers.length > 0 && (
              <ChartCard title="Top Attacker Sources">
                <BarChart width={340} height={200} data={topAttackers} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis type="number" tick={{ fontSize: 9 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={100} />
                  <Tooltip contentStyle={TT_STYLE} />
                  <Bar dataKey="value" fill="#ef4444" radius={[0,3,3,0]} />
                </BarChart>
              </ChartCard>
            )}
          </div>

          {connTable && connTable.rows.length > 0 && (
            <>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Top Connections</p>
              <DataTable
                columns={connTable.columns.slice(0, 6)}
                rows={connTable.rows.slice(0, 8)}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────
function ReportFooter({ orgName, generatedAt }) {
  return (
    <div style={{ background: '#1e1b4b', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <p style={{ margin: 0, fontSize: 10, color: '#a5b4fc' }}>CISO Dashboard — {orgName}</p>
      <p style={{ margin: 0, fontSize: 10, color: '#a5b4fc' }}>Generated {new Date(generatedAt).toLocaleString()}</p>
    </div>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────
export default function ReportDocument({ data }) {
  if (!data) return null;
  const { orgName, generatedAt, s1Threats, s1Agents, s1Cves, harmonyEvents, fwRiskRaw, fwAttackersRaw, fwConnectionsRaw } = data;

  return (
    <div style={{ width: 794, background: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#111827' }}>
      <CoverPage orgName={orgName} generatedAt={generatedAt} />
      <ExecutiveSummary s1Threats={s1Threats} s1Agents={s1Agents} harmonyEvents={harmonyEvents} />
      <CheckpointSection harmonyEvents={harmonyEvents} />
      <S1ThreatsSection s1Threats={s1Threats} />
      <S1AgentsSection s1Agents={s1Agents} />
      <S1CveSection s1Cves={s1Cves} />
      <FirewallSection fwRiskRaw={fwRiskRaw} fwAttackersRaw={fwAttackersRaw} fwConnectionsRaw={fwConnectionsRaw} />
      <ReportFooter orgName={orgName} generatedAt={generatedAt} />
    </div>
  );
}
