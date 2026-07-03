import { useMemo } from 'react';
import {
  Cell,
  BarChart, Bar, LabelList,
  LineChart, Line,
  ComposedChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { PdfPieChart } from './PdfPieChart';

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

// ── Logo placeholders — replace null with your imported asset ─────────────────
// import checkpointLogo  from './logos/checkpoint.png';
// import sentinelOneLogo from './logos/sentinelone.png';
// import paloAltoLogo    from './logos/paloalto.png';
// import zohoLogo        from './logos/zoho.png';
const checkpointLogo  = null;
const sentinelOneLogo = null;
const paloAltoLogo    = null;
const zohoLogo        = null;

// ── Section cover page ────────────────────────────────────────────────────────
// Height fills the A4-landscape page at 1400px render width (pageH ≈ 990px).
// 976px leaves a 14px safety margin against sub-pixel rounding.
function SectionCoverPage({ number, title, subtitle, color, logo, logoLabel }) {
  return (
    <div data-pdf-block="true" style={{
      width: '100%', height: 976,
      background: '#0f172a',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', position: 'relative',
    }}>
      {/* Top accent bar */}
      <div style={{ height: 5, background: color, flexShrink: 0 }} />

      {/* Main body */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 80px', gap: 64, position: 'relative', zIndex: 1 }}>

        {/* Text */}
        <div style={{ flex: 1 }}>
          <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
            Section {number}
          </p>
          <h2 style={{ margin: '0 0 24px', fontSize: 46, fontWeight: 800, color: '#fff', lineHeight: 1.15, letterSpacing: '-0.02em' }}>
            {title}
          </h2>
          <p style={{ margin: 0, fontSize: 15, color: '#94a3b8', lineHeight: 1.8, maxWidth: 520 }}>
            {subtitle}
          </p>
        </div>

        {/* Logo box */}
        <div style={{ width: 250, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            width: 220, height: 148,
            border: '2px dashed rgba(255,255,255,0.13)',
            borderRadius: 14,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
            background: 'rgba(255,255,255,0.03)',
          }}>
            {logo ? (
              <img src={logo} alt={title} style={{ maxWidth: 160, maxHeight: 100, objectFit: 'contain' }} />
            ) : (
              <>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
                </svg>
                <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', fontStyle: 'italic', lineHeight: 1.5, padding: '0 16px' }}>
                  {logoLabel || 'Logo placeholder'}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Faded section-number watermark */}
      <div style={{
        position: 'absolute', right: -8, bottom: 44, zIndex: 0,
        fontSize: 220, fontWeight: 900, lineHeight: 1,
        color: 'rgba(255,255,255,0.03)', userSelect: 'none', pointerEvents: 'none',
      }}>
        {String(number).padStart(2, '0')}
      </div>

      {/* Bottom bar */}
      <div style={{
        height: 44, flexShrink: 0,
        borderTop: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center',
        padding: '0 80px', justifyContent: 'space-between', position: 'relative', zIndex: 1,
      }}>
        <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          CISO Security Report
        </p>
        <div style={{ height: 2, width: 140, background: `linear-gradient(to right, ${color}, transparent)`, borderRadius: 2 }} />
      </div>
    </div>
  );
}

// ── Layout primitives ─────────────────────────────────────────────────────────
const TT_STYLE = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13 };

function SectionHeader({ number, title, color = '#4f46e5', children }) {
  return (
    <div data-pdf-block="true" style={{ marginBottom: 16, marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: children ? 8 : 0 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6, background: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: 15, flexShrink: 0,
        }}>{number}</div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827', borderBottom: `2px solid ${color}`, paddingBottom: 4, flex: 1 }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function KpiCard({ label, value, sub, color = '#4f46e5' }) {
  return (
    <div style={{
      background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10,
      padding: '14px 18px', flex: '1 1 0', minWidth: 120,
    }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 15, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// w = explicit pixel width of the card (required to prevent overflow)
// compact = reduces header and content padding to shrink card height without touching chart size
function ChartCard({ title, children, w, description, compact }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
      flexShrink: 0,
      width: w ?? 'auto',
    }}>
      <div style={{ padding: compact ? '6px 14px' : '10px 14px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#374151' }}>{title}</p>
      </div>
      <div style={{ padding: compact ? '4px 0' : '10px 0 10px 0' }}>{children}</div>
      {description && (
        <div style={{ padding: '6px 14px 10px', borderTop: '1px solid #f3f4f6' }}>
          <p style={{ margin: 0, fontSize: 15, color: '#6b7280', fontStyle: 'italic', lineHeight: 1.55 }}>{description}</p>
        </div>
      )}
    </div>
  );
}

// KpiRow — atomic flex row of KpiCard/WowKpiCard elements; marked as a PDF block
// so the whole row moves to the next page if it would otherwise be split.
function KpiRow({ children, gap = 12, wrap = false, mb = 16 }) {
  return (
    <div
      data-pdf-block="true"
      style={{ display: 'flex', gap, flexWrap: wrap ? 'wrap' : 'nowrap', marginBottom: mb }}
    >
      {children}
    </div>
  );
}

// ChartRow — atomic flex row of ChartCard elements; marked as a PDF block.
function ChartRow({ children, mb = 12 }) {
  return (
    <div
      data-pdf-block="true"
      style={{ display: 'flex', gap: 12, marginBottom: mb }}
    >
      {children}
    </div>
  );
}

// Layout constants — content area = 1400 − 64px section padding = 1336px
// Card border = 1px each side → inner = card_w − 2. Chart fills inner.
const W2  = 662;   // 2-col card width:  (1336 − 12) / 2 = 662
const W3  = 437;   // 3-col card width:  (1336 − 24) / 3 ≈ 437
const WF  = 1336;  // full-width card
const CW2 = W2  - 2;  // chart width inside 2-col card
const CW3 = W3  - 2;  // chart width inside 3-col card
const CWF = WF  - 2;  // chart width inside full-width card

function DataTable({ title, columns, rows, maxRows = 8 }) {
  if (!rows || rows.length === 0) {
    return (
      <div data-pdf-block="true">
        {title && <p style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</p>}
        <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '12px 0' }}>No data available</p>
      </div>
    );
  }
  const displayRows = rows.slice(0, maxRows);
  return (
    <div data-pdf-block="true">
    {title && <p style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</p>}
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ background: '#f9fafb' }}>
          {columns.map(col => (
            <th key={col} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', fontSize: 12, letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb' }}>
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
    </div>
  );
}

function NoData() {
  return <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>No data available</p>;
}

// ── Section 1: Cover Page ─────────────────────────────────────────────────────
const REPORT_INDEX = [
  { number: '1', title: 'Checkpoint Harmony — Email & Cloud Security', color: '#2563eb' },
  {
    number: '2', title: 'SentinelOne', color: '#ef4444',
    children: [
      { label: '2.1', title: 'Threat Analytics' },
      { label: '2.2', title: 'Agent Analytics' },
      { label: '2.3', title: 'Most At-Risk Entities' },
      { label: '2.4', title: 'Application CVEs' },
      { label: '2.5', title: 'Application Insights — Installed Applications' },
    ],
  },
  { number: '3', title: 'Zoho Desk — Support Tickets', color: '#f59e0b' },
  { number: '4', title: 'Palo Alto Firewall — Network Security', color: '#f97316' },
  { number: '5', title: 'Weekly Insights — 7-Day Comparison', color: '#7c3aed' },
];

function CoverPage({ orgName, generatedAt, groups }) {
  const dateStr = new Date(generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div style={{ background: '#1e1b4b', height: 976, display: 'flex', flexDirection: 'column', borderRadius: 0, overflow: 'hidden' }}>
      {/* Top accent */}
      <div style={{ height: 5, background: '#4f46e5', flexShrink: 0 }} />

      {/* Hero area */}
      <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 80px 32px', textAlign: 'center' }}>
        <div style={{ width: 80, height: 80, background: 'rgba(255,255,255,0.08)', border: '1px dashed #6366f1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
          <span style={{ fontSize: 12, color: '#a5b4fc', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Logo</span>
        </div>
        <h1 style={{ margin: '0 0 10px', fontSize: 40, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>CISO Security Report</h1>
        <p style={{ margin: '0 0 20px', fontSize: 20, color: '#a5b4fc' }}>{orgName}</p>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 28px' }}>
          <p style={{ margin: 0, fontSize: 16, color: '#c7d2fe' }}>{dateStr}</p>
        </div>
      </div>

      {/* Index — fills remaining space */}
      <div style={{ flex: 1, padding: '0 80px 48px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '24px 32px', flex: 1 }}>
          <p style={{ margin: '0 0 18px', fontSize: 14, color: '#818cf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Report Index</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {REPORT_INDEX.map(({ number, title, color, children }) => (
              <div key={number}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 26, height: 26, borderRadius: 6, background: color, color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{number}</span>
                  <span style={{ fontSize: 16, color: '#e0e7ff', fontWeight: 600 }}>{title}</span>
                </div>
                {children && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 32px', marginTop: 8, marginLeft: 38 }}>
                    {children.map(({ label, title: childTitle }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, width: 'calc(50% - 16px)' }}>
                        <span style={{ fontSize: 13, color: '#818cf8', fontWeight: 700, flexShrink: 0, minWidth: 24 }}>{label}</span>
                        <span style={{ fontSize: 14, color: '#c7d2fe' }}>{childTitle}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ height: 44, flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', padding: '0 80px', justifyContent: 'space-between' }}>
        <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>CISO Security Report</p>
        <div style={{ height: 2, width: 140, background: 'linear-gradient(to right, #4f46e5, transparent)', borderRadius: 2 }} />
      </div>
    </div>
  );
}

// ── Section 2: Executive Summary ──────────────────────────────────────────────
// function ExecutiveSummary({ s1Threats, s1Agents, harmonyEvents }) {
//   const totalThreats   = Array.isArray(s1Threats) ? s1Threats.length : 0;
//   const activeAgents   = Array.isArray(s1Agents)  ? s1Agents.filter(a => String(a.network_status || a.networkStatus || '').toLowerCase() === 'connected').length : 0;
//   const totalAgents    = Array.isArray(s1Agents)  ? s1Agents.length : 0;
//   const cpEvents       = Array.isArray(harmonyEvents) ? harmonyEvents.length : 0;
//   const criticalThreats = Array.isArray(s1Threats) ? s1Threats.filter(t => String(t.severity || '').toLowerCase() === 'critical' || Number(t.classification_source_id) >= 4).length : 0;

//   return (
//     <div style={{ padding: '24px 32px', background: '#fff' }}>
//       <SectionHeader number="1" title="Executive Summary" color="#4f46e5" />
//       <KpiRow>
//         <KpiCard label="Total Threats" value={totalThreats} sub="SentinelOne detections" color="#ef4444" />
//         <KpiCard label="Critical Threats" value={criticalThreats} sub="High severity" color="#f97316" />
//         <KpiCard label="Active Agents" value={`${activeAgents}/${totalAgents}`} sub="Endpoints connected" color="#10b981" />
//         <KpiCard label="Harmony Events" value={cpEvents} sub="Checkpoint detections" color="#4f46e5" />
//       </KpiRow>
//       <div data-pdf-block="true" style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 16px' }}>
//         <p style={{ margin: 0, fontSize: 14, color: '#166534' }}>
//           <strong>Report Period:</strong> This report covers all security events currently synced to the CISO Dashboard across all integrated platforms.
//           {totalThreats === 0 && cpEvents === 0 ? ' No threats detected across all platforms.' : ` ${totalThreats} endpoint threat${totalThreats !== 1 ? 's' : ''} and ${cpEvents} email security event${cpEvents !== 1 ? 's' : ''} detected.`}
//         </p>
//       </div>
//     </div>
//   );
// }

// ── Section 3: Checkpoint Harmony ────────────────────────────────────────────
function CheckpointSection({ harmonyEvents, weeklyStats }) {
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
    <>
    <div data-pdf-section="true" style={{ padding: '24px 32px', background: '#fff', borderTop: '1px solid #f3f4f6' }}>
      <SectionHeader number="2" title="Checkpoint Harmony — Email & Cloud Security" color="#2563eb">
        <p style={{ fontSize: 13, color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
          {events.length} email and cloud security events were recorded across {new Set(events.map(e => e.type).filter(Boolean)).size || 0} distinct event type{new Set(events.map(e => e.type).filter(Boolean)).size !== 1 ? 's' : ''}.{' '}
          {events.filter(e => e.state === 'pending').length} event{events.filter(e => e.state === 'pending').length !== 1 ? 's are' : ' is'} pending action; {events.filter(e => ['remediated','done','closed'].includes(e.state)).length} have been resolved.{' '}
          The table below shows the most recent detections — review pending items and confirm remediation actions are complete.
        </p>
      </SectionHeader>
      <KpiRow>
        <KpiCard label="Total Events" value={events.length} sub="All event types" color="#2563eb" />
        <KpiCard label="Pending Actions" value={events.filter(e => e.state === 'pending').length} sub="Require attention" color="#f59e0b" />
        <KpiCard label="Remediated" value={events.filter(e => ['remediated','done','closed'].includes(e.state)).length} sub="Resolved events" color="#10b981" />
      </KpiRow>

      {events.length > 0 && (
        <ChartRow mb={16}>
          <ChartCard title="Severity Distribution" w={W3}>
            <PdfPieChart
              width={CW3} height={200}
              data={severityData.map((d, i) => ({
                ...d,
                name: d.name === '3' ? 'High' : d.name === '4' ? 'Critical' : d.name,
                fill: SEV_COLORS[i % SEV_COLORS.length],
              }))}
            />
          </ChartCard>

          <ChartCard title="Event State Breakdown" w={W3}>
            <PdfPieChart
              width={CW3} height={200}
              data={stateData.map((d, i) => ({ ...d, fill: STATE_COLORS[d.name] ?? COLORS[i % COLORS.length] }))}
            />
          </ChartCard>

          <ChartCard title="Top Event Types" w={W3}>
            {typeData.length === 0 ? <NoData /> : (
              <BarChart width={CW3} height={200} data={typeData} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                <Tooltip contentStyle={TT_STYLE} />
                <Bar dataKey="value" fill="#3b82f6" radius={[0,3,3,0]} />
              </BarChart>
            )}
          </ChartCard>
        </ChartRow>
      )}

      {events.length > 0 && (
        <div data-pdf-block="true" style={{ marginTop: 16 }}>
          <DataTable
            title="Recent Events (Top 10)"
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

    {weeklyStats && events.length > 0 && (
      <div data-pdf-section="true" style={{ padding: '24px 32px', background: '#fff', borderTop: '1px solid #f3f4f6' }}>
        <SectionHeader number="2W" title="Checkpoint Harmony — Week-over-Week Analysis" color="#2563eb">
          <p style={{ fontSize: 13, color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
            Week-over-week comparison for Checkpoint Harmony events.{' '}
            {weeklyStats.kpi.harmonyThis} event{weeklyStats.kpi.harmonyThis !== 1 ? 's' : ''} recorded this period
            vs {weeklyStats.kpi.harmonyLast} the prior week.{' '}
            Remediation rate: {weeklyStats.kpi.remRateThis}%{weeklyStats.kpi.remRateLast > 0 ? ` (was ${weeklyStats.kpi.remRateLast}% last week)` : ''}.
          </p>
        </SectionHeader>

        <div data-pdf-block="true" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 14px', marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 13, color: '#1d4ed8' }}>
            <strong>Period:</strong> {weeklyStats.periodLabel} &nbsp;·&nbsp; Compared against the preceding 7 days.
          </p>
        </div>

        <KpiRow mb={16}>
          <WowKpiCard label="Harmony Events"        thisWeek={weeklyStats.kpi.harmonyThis} lastWeek={weeklyStats.kpi.harmonyLast} higherIsBetter={false} />
          <WowKpiCard label="Remediation Rate"       thisWeek={weeklyStats.kpi.remRateThis} lastWeek={weeklyStats.kpi.remRateLast} unit="%" higherIsBetter={true} />
          <WowKpiCard label="Critical / High Events" thisWeek={weeklyStats.kpi.critThis}    lastWeek={weeklyStats.kpi.critLast}    higherIsBetter={false} />
        </KpiRow>

        <ChartRow>
          <ChartCard title="14-Day Harmony Event Trend (by Type)" w={W2}>
            {weeklyStats.eventTypes.length === 0 ? <NoData /> : (
              <BarChart width={CW2} height={240} data={weeklyStats.trend14dEvents} margin={{ left: 4, right: 8, top: 8, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip contentStyle={TT_STYLE} />
                <Legend iconSize={9} wrapperStyle={{ fontSize: 12 }} />
                {weeklyStats.eventTypes.map((type, i) => (
                  <Bar key={type} dataKey={type} stackId="a"
                    fill={EVENT_TYPE_COLORS_RPT[type] ?? FALLBACK_COLORS_RPT[i % FALLBACK_COLORS_RPT.length]}
                    name={type.replace(/_/g, ' ')} />
                ))}
              </BarChart>
            )}
          </ChartCard>

          <ChartCard title="Daily Event Volume — This Week vs Last Week" w={W2}>
            <BarChart width={CW2} height={240} data={weeklyStats.remComp} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="day" tick={{ fontSize: 13 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip contentStyle={TT_STYLE} />
              <Legend iconSize={9} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="This Week" fill="#6366f1" radius={[3,3,0,0]} maxBarSize={26} />
              <Bar dataKey="Last Week" fill="#a5b4fc" radius={[3,3,0,0]} maxBarSize={26} />
            </BarChart>
          </ChartCard>
        </ChartRow>

        {weeklyStats.severityShift.length > 0 && (
          <div data-pdf-block="true" style={{ marginBottom: 16 }}>
            <ChartCard title="Severity Distribution Shift" w={WF}>
              <BarChart width={CWF} height={200} data={weeklyStats.severityShift} margin={{ left: 16, right: 24, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="severity" tick={{ fontSize: 13 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip contentStyle={TT_STYLE} />
                <Legend iconSize={9} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="thisWeek" fill="#6366f1" radius={[3,3,0,0]} maxBarSize={50} name="This Week" />
                <Bar dataKey="lastWeek" fill="#a5b4fc" radius={[3,3,0,0]} maxBarSize={50} name="Last Week" />
              </BarChart>
            </ChartCard>
          </div>
        )}

        {weeklyStats.topSenders.length > 0 && (
          <div data-pdf-block="true">
            <DataTable
              title="Top Senders — Week-over-Week"
              columns={['sender_address', 'This Week', 'Last Week', 'Change']}
              rows={weeklyStats.topSenders}
              maxRows={10}
            />
          </div>
        )}
      </div>
    )}
    </>
  );
}

function formatDuration(minutes) {
  if (!minutes || minutes < 1) return '<1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) { const h = Math.floor(minutes / 60), m = Math.round(minutes % 60); return m > 0 ? `${h}h ${m}m` : `${h}h`; }
  const d = Math.floor(minutes / 1440), h = Math.round((minutes % 1440) / 60);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

// ── Section 4: SentinelOne Threats ────────────────────────────────────────────
// S1 threat records store data under t.threatInfo.* and t.agentRealtimeInfo.*
function S1ThreatsSection({ s1Threats }) {
  const threats = Array.isArray(s1Threats) ? s1Threats : [];

  const mitigationData = useMemo(() => {
    const counts = {};
    threats.forEach(t => {
      const m = String(t.threatInfo?.mitigationStatus || 'unknown');
      counts[m] = (counts[m] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 20) + '…' : name, value }));
  }, [threats]);

  const classData = useMemo(() => {
    const counts = {};
    threats.forEach(t => {
      const c = t.threatInfo?.classification || 'Unknown';
      counts[c] = (counts[c] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 20) + '…' : name, value }));
  }, [threats]);

  const confidenceData = useMemo(() => {
    const counts = {};
    threats.forEach(t => {
      const s = t.threatInfo?.confidenceLevel || t.threatInfo?.classification || 'Unknown';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, value], i) => ({ name, value, fill: SEV_COLORS[i % SEV_COLORS.length] }));
  }, [threats]);

  const engineData = useMemo(() => {
    const counts = {};
    threats.forEach(t => {
      (t.threatInfo?.engines || []).forEach(e => {
        const k = typeof e === 'string' ? e : (e?.name || 'Unknown');
        counts[k] = (counts[k] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([name, value]) => ({ name: name.length > 30 ? name.slice(0, 30) + '…' : name, value }));
  }, [threats]);

  const tacticData = useMemo(() => {
    const counts = {};
    threats.forEach(t => {
      (t.indicators || []).forEach(ind => {
        (ind.tactics || []).forEach(tac => {
          if (tac.name) counts[tac.name] = (counts[tac.name] || 0) + 1;
        });
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12)
      .map(([name, value]) => ({ name: name.length > 22 ? name.slice(0, 22) + '…' : name, value }));
  }, [threats]);

  const siteData = useMemo(() => {
    const counts = {};
    threats.forEach(t => {
      const k = t.agentRealtimeInfo?.siteName || 'Unknown';
      counts[k] = (counts[k] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([name, value]) => ({ name: name.length > 22 ? name.slice(0, 22) + '…' : name, value }));
  }, [threats]);

  const mitigRateByClass = useMemo(() => {
    const map = {};
    threats.forEach(t => {
      const cls = t.threatInfo?.classification || 'Unknown';
      if (!map[cls]) map[cls] = { total: 0, mitigated: 0 };
      map[cls].total++;
      if (t.threatInfo?.mitigationStatus === 'mitigated') map[cls].mitigated++;
    });
    return Object.entries(map)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name, { total, mitigated }]) => ({
        name: name.length > 16 ? name.slice(0, 16) + '…' : name,
        total, mitigated,
        rate: total > 0 ? Math.round((mitigated / total) * 100) : 0,
      }));
  }, [threats]);

  const incidentStatusData = useMemo(() => {
    const counts = {};
    threats.forEach(t => {
      const s = t.threatInfo?.incidentStatus || 'unknown';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [threats]);

  const mitigTypeData = useMemo(() => {
    let auto = 0, manual = 0, none = 0, benign = 0;
    const autoMs = [], manualMs = [];
    threats.forEach(t => {
      const s = t.threatInfo?.mitigationStatus || '';
      const created  = t.threatInfo?.createdAt   ? new Date(t.threatInfo.createdAt)   : null;
      const resolved = t.threatInfo?.mitigatedAt  ? new Date(t.threatInfo.mitigatedAt) : null;
      const ms = (created && resolved && resolved > created) ? resolved - created : null;
      if (s === 'mitigated_preemptively') { auto++;   if (ms !== null) autoMs.push(ms);   }
      else if (s === 'mitigated')         { manual++;  if (ms !== null) manualMs.push(ms); }
      else if (s === 'marked_as_benign')  { benign++; }
      else                                { none++;   }
    });
    const avgMin = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length / 60000) : null;
    return {
      auto, manual, none, benign,
      avgAutoMin:   avgMin(autoMs),
      avgManualMin: avgMin(manualMs),
      donut: [
        { name: 'Auto Mitigated',   value: auto,   fill: '#10b981' },
        { name: 'Manual Mitigated', value: manual, fill: '#3b82f6' },
        { name: 'Not Mitigated',    value: none,   fill: '#ef4444' },
        { name: 'Marked Benign',    value: benign, fill: '#64748b' },
      ].filter(d => d.value > 0).sort((a, b) => b.value - a.value),
    };
  }, [threats]);

  const mitigated   = threats.filter(t => t.threatInfo?.mitigationStatus === 'mitigated').length;
  const unresolved  = threats.filter(t => ['unresolved', 'active'].includes(t.threatInfo?.incidentStatus)).length;
  const affectedEndpoints = useMemo(
    () => new Set(threats.map(t => t.agentComputerName || t.computerName || t.agentId).filter(Boolean)).size,
    [threats]
  );
  const mitigatedCount    = threats.filter(t => ['mitigated', 'mitigated_preemptively'].includes(t.threatInfo?.mitigationStatus)).length;
  const notMitigatedCount = threats.filter(t => ['not_mitigated', 'unmitigated', 'active'].includes(t.threatInfo?.mitigationStatus)).length;
  const benignCount       = threats.filter(t => t.threatInfo?.mitigationStatus === 'marked_as_benign').length;

  const filelessData = useMemo(() => {
    const f = threats.filter(t => t.threatInfo?.isFileless).length;
    return [
      { name: 'File-based', value: threats.length - f, fill: '#3b82f6' },
      { name: 'Fileless',   value: f,                  fill: '#ef4444' },
    ];
  }, [threats]);

  const { avgMttd, avgMttm } = useMemo(() => {
    let mttdSum = 0, mttdCount = 0, mttmSum = 0, mttmCount = 0;
    threats.forEach(t => {
      const created    = t.threatInfo?.createdAt    ? new Date(t.threatInfo.createdAt)    : null;
      const identified = t.threatInfo?.identifiedAt ? new Date(t.threatInfo.identifiedAt) : null;
      if (created && identified && !isNaN(created) && !isNaN(identified)) {
        mttdSum += Math.abs(created - identified) / 60000; mttdCount++;
      }
      const successEntry = (t.mitigationStatus || []).find(s => s.status === 'success');
      if (successEntry && identified) {
        const ended = successEntry.mitigationEndedAt ? new Date(successEntry.mitigationEndedAt) : null;
        if (ended && !isNaN(ended)) { mttmSum += (ended - identified) / 60000; mttmCount++; }
      }
    });
    return {
      avgMttd: mttdCount > 0 ? mttdSum / mttdCount : null,
      avgMttm: mttmCount > 0 ? mttmSum / mttmCount : null,
    };
  }, [threats]);

  // Chart descriptions
  const mitPct    = threats.length > 0 ? Math.round(mitigated / threats.length * 100) : 0;
  const topMit    = mitigationData[0];
  const topClass  = classData[0];
  const topConf   = [...confidenceData].sort((a, b) => b.value - a.value)[0];
  const topEngine = engineData[0];
  const topTactic = tacticData[0];
  const lowestMitClass = mitigRateByClass.length > 0
    ? mitigRateByClass.reduce((a, b) => a.rate < b.rate ? a : b)
    : null;

  return (
    <>
    <div data-pdf-section="true" style={{ padding: '24px 32px', background: '#fff', borderTop: '1px solid #f3f4f6' }}>
      <SectionHeader number="3" title="SentinelOne — Threat Analytics" color="#ef4444">
        <p style={{ fontSize: 13, color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
          {threats.length} threat{threats.length !== 1 ? 's' : ''} detected across monitored endpoints.{' '}
          {mitigated} ({threats.length > 0 ? Math.round(mitigated / threats.length * 100) : 0}%) have been mitigated
          {unresolved > 0 ? `; ${unresolved} remain active or unresolved and require follow-up` : ''}.{' '}
          {classData[0] ? `The most prevalent classification is "${classData[0].name}" (${classData[0].value} detections).` : ''}
          {' '}Charts below break down detection status, confidence, classification, engine coverage, and MITRE ATT&CK tactic spread.
        </p>
      </SectionHeader>
      <KpiRow>
        <KpiCard label="Total Threats" value={threats.length}   color="#ef4444" sub="since deployment" />
        <KpiCard label="Mitigated"     value={mitigated}         color="#10b981" />
        <KpiCard label="Unresolved"    value={unresolved}        color="#f59e0b" />
        <KpiCard label="Avg MTTD"      value={avgMttd !== null ? formatDuration(avgMttd) : 'N/A'} color="#8b5cf6" sub="mean time to detect" />
        <KpiCard label="Avg MTTM"      value={avgMttm !== null ? formatDuration(avgMttm) : 'N/A'} color="#06b6d4" sub="mean time to mitigate" />
      </KpiRow>

      {threats.length === 0 ? <NoData /> : (
        <ChartRow mb={16}>
          <ChartCard title="Mitigation Status" w={W3}
            description={topMit ? `"${topMit.name}" is the most common status with ${topMit.value} threat${topMit.value !== 1 ? 's' : ''}. Overall, ${mitigated} of ${threats.length} threats (${mitPct}%) have been mitigated. Mitigated: contained and neutralized. Not Mitigated: still active, requires response. Marked as Benign: reviewed and deemed non-malicious.` : 'Mitigated: contained and neutralized. Not Mitigated: still active, requires response. Marked as Benign: reviewed and deemed non-malicious.'}>
            {mitigationData.length === 0 ? <NoData /> : (
              <BarChart width={CW3} height={280} data={mitigationData} layout="vertical" margin={{ left: 4, right: 36, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis type="number" tick={{ fontSize: 13 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={115} />
                <Tooltip contentStyle={TT_STYLE} />
                <Bar dataKey="value" fill="#ef4444" radius={[0, 3, 3, 0]}>
                  <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
                </Bar>
              </BarChart>
            )}
          </ChartCard>

          <ChartCard title="Confidence Level" w={W3}
            description={topConf ? `Most threats are identified as "${topConf.name}" (${topConf.value}). Confidence reflects detection certainty — high-confidence detections warrant immediate investigation.` : undefined}>
            <BarChart width={CW3} height={240} data={confidenceData} layout="vertical" margin={{ left: 4, right: 36, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={90} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TT_STYLE} />
              <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={26} name="Threats">
                {confidenceData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ChartCard>

          <ChartCard title="Classification" w={W3}
            description={topClass ? `"${topClass.name}" is the most prevalent classification with ${topClass.value} detection${topClass.value !== 1 ? 's' : ''}. Use this breakdown to prioritise response playbooks by threat type.` : undefined}>
            {classData.length === 0 ? <NoData /> : (
              <BarChart width={CW3} height={280} data={classData} layout="vertical" margin={{ left: 4, right: 36, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis type="number" tick={{ fontSize: 13 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={115} />
                <Tooltip contentStyle={TT_STYLE} />
                <Bar dataKey="value" fill="#f97316" radius={[0, 3, 3, 0]}>
                  <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
                </Bar>
              </BarChart>
            )}
          </ChartCard>
        </ChartRow>
      )}

      {threats.length > 0 && (
        <ChartRow mb={16}>
          <ChartCard title="Detection Engine Breakdown" w={W3} compact>
            {engineData.length === 0 ? <NoData /> : (
              <BarChart width={CW3} height={260} data={engineData} layout="vertical" margin={{ left: 4, right: 36, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis type="number" tick={{ fontSize: 13 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={115} />
                <Tooltip contentStyle={TT_STYLE} />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 3, 3, 0]}>
                  <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
                </Bar>
              </BarChart>
            )}
          </ChartCard>

          <ChartCard title="MITRE ATT&CK Tactics" w={W3} compact>
            {tacticData.length === 0 ? <NoData /> : (
              <BarChart width={CW3} height={260} data={tacticData} layout="vertical" margin={{ left: 4, right: 36, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis type="number" tick={{ fontSize: 13 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={110} />
                <Tooltip contentStyle={TT_STYLE} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 3, 3, 0]}>
                  <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
                </Bar>
              </BarChart>
            )}
          </ChartCard>

          <ChartCard title="Incident Status" w={W3} compact>
            {incidentStatusData.length === 0 ? <NoData /> : (
              <BarChart width={CW3} height={260} data={incidentStatusData} layout="vertical" margin={{ left: 4, right: 36, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis type="number" tick={{ fontSize: 13 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={85} />
                <Tooltip contentStyle={TT_STYLE} />
                <Bar dataKey="value" fill="#f59e0b" radius={[0, 3, 3, 0]}>
                  <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
                </Bar>
              </BarChart>
            )}
          </ChartCard>
        </ChartRow>
      )}

      {threats.length > 0 && (
        <ChartRow mb={16}>
          <ChartCard
            title="Fileless vs File-based"
            w={W2}
            description={`${filelessData[1]?.value ?? 0} fileless threat${(filelessData[1]?.value ?? 0) !== 1 ? "s" : ""} detected. Fileless attacks execute in-memory and evade traditional file scanning.`}
          >
            <BarChart
              width={CW2}
              height={180}
              data={filelessData}
              layout="vertical"
              margin={{ left: 4, right: 36, top: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis type="number" tick={{ fontSize: 13 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
              <Tooltip contentStyle={TT_STYLE} />
              <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={40}>
                {filelessData.map((d, i) => (
                  <Cell key={i} fill={d.fill} />
                ))}
                <LabelList
                  dataKey="value"
                  position="right"
                  style={{ fontSize: 12, fill: "#374151", fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ChartCard>
        </ChartRow>
      )}

      {siteData.length > 0 && (
        <div data-pdf-section="true" style={{ marginBottom: 16 }}>
          <ChartCard title="Threats by Site" w={WF} compact>
            <BarChart width={CWF} height={220} data={siteData} layout="vertical" margin={{ left: 4, right: 36, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis type="number" tick={{ fontSize: 13 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={140} />
              <Tooltip contentStyle={TT_STYLE} />
              <Bar dataKey="value" fill="#10b981" radius={[0, 3, 3, 0]}>
                <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ChartCard>
        </div>
      )}

      {mitigRateByClass.length > 0 && (
        <div data-pdf-block="true" style={{ marginBottom: 16 }}>
          <ChartCard title="Mitigation Rate by Classification (%)" w={WF}>
            <BarChart width={CWF} height={200} data={mitigRateByClass} margin={{ left: 16, right: 24, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 13 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 13 }} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={TT_STYLE} formatter={(v, name) => name === 'rate' ? [`${v}%`, 'Mitigation Rate'] : [v, name]} />
              <Bar dataKey="rate" name="Mitigation Rate %" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={50}>
                <LabelList dataKey="rate" position="top" formatter={v => `${v}%`} style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ChartCard>
        </div>
      )}

      {mitigTypeData.donut.length > 0 && (
        <>
          <KpiRow mb={12}>
            <KpiCard label="Auto Mitigated"    value={mitigTypeData.auto}   color="#10b981"
              sub={mitigTypeData.avgAutoMin   !== null ? `Avg ${mitigTypeData.avgAutoMin} min`   : undefined} />
            <KpiCard label="Manually Mitigated" value={mitigTypeData.manual} color="#3b82f6"
              sub={mitigTypeData.avgManualMin !== null ? `Avg ${mitigTypeData.avgManualMin} min` : undefined} />
            <KpiCard label="Not Mitigated"      value={mitigTypeData.none}   color="#ef4444" />
            {mitigTypeData.benign > 0 && <KpiCard label="Marked Benign" value={mitigTypeData.benign} color="#64748b" />}
          </KpiRow>
          {/* <ChartRow mb={16}>
            <ChartCard title="Mitigation Response Breakdown" w={W2}>
              <BarChart width={CW2} height={200} data={mitigTypeData.donut} layout="vertical" margin={{ left: 4, right: 36, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={120} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TT_STYLE} />
                <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={26} name="Threats">
                  {mitigTypeData.donut.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ChartCard>
          </ChartRow> */}
        </>
      )}

    </div>

    {threats.length > 0 && (
      <div data-pdf-section="true" style={{ padding: '24px 32px', background: '#fff' }}>
        <DataTable
          title="Recent Threats (Top 12)"
          columns={['Threat Name', 'Classification', 'Mitigation', 'Incident Status', 'Detected']}
          rows={threats.slice(0, 12).map(t => ({
            'Threat Name':     (t.threatInfo?.threatName || t.threatInfo?.threatFilePath || '-').slice(0, 40),
            'Classification':  (t.threatInfo?.classification || '-').slice(0, 25),
            'Mitigation':      t.threatInfo?.mitigationStatus || '-',
            'Incident Status': t.threatInfo?.incidentStatus   || '-',
            'Detected':        t.threatInfo?.createdAt ? new Date(t.threatInfo.createdAt).toLocaleDateString() : '-',
          }))}
          maxRows={12}
        />
      </div>
    )}
    </>
  );
}

// ── Section 5: SentinelOne Agents ─────────────────────────────────────────────
function S1AgentsSection({ s1Agents, generatedAt, removedAgentsCount }) {
  const agents = Array.isArray(s1Agents) ? s1Agents : [];

  const newAgents = useMemo(() => {
    const cutoff = new Date(generatedAt);
    cutoff.setDate(cutoff.getDate() - 30);
    return agents.filter(a => {
      const d = a.registeredAt || a.createdAt || a.registered_at || a.created_at;
      return d && new Date(d) >= cutoff;
    }).length;
  }, [agents, generatedAt]);

  const statusData = useMemo(() => {
    const counts = {};
    agents.forEach(a => { const s = String(a.network_status || a.networkStatus || 'unknown'); counts[s] = (counts[s]||0)+1; });
    return Object.entries(counts).map(([name,value]) => ({ name, value }));
  }, [agents]);

  const osData = useMemo(() => {
    const counts = {};
    agents.forEach(a => { const s = a.os_type || a.osType || a.os || 'Unknown'; counts[s] = (counts[s]||0)+1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name,value]) => ({ name, value }));
  }, [agents]);

  const machineTypeData = useMemo(() => {
    const counts = {};
    agents.forEach(a => { const s = a.machineType || a.machine_type || 'Unknown'; counts[s] = (counts[s]||0)+1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, value], i) => ({ name, value, fill: COLORS[i % COLORS.length] }));
  }, [agents]);

  return (
    <div data-pdf-section="true" style={{ padding: '24px 32px', background: '#fff', borderTop: '1px solid #f3f4f6' }}>
      <SectionHeader number="4" title="SentinelOne — Agent Analytics" color="#10b981">
        <p style={{ fontSize: 13, color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
          {agents.length} SentinelOne agent{agents.length !== 1 ? 's' : ''} registered across the fleet.{' '}
          {agents.filter(a => String(a.network_status || a.networkStatus || '').toLowerCase() === 'connected').length} ({agents.length > 0 ? Math.round(agents.filter(a => String(a.network_status || a.networkStatus || '').toLowerCase() === 'connected').length / agents.length * 100) : 0}%) are currently online and receiving real-time protection.{' '}
          {agents.filter(a => String(a.network_status || a.networkStatus || '').toLowerCase() === 'disconnected').length > 0
            ? `${agents.filter(a => String(a.network_status || a.networkStatus || '').toLowerCase() === 'disconnected').length} agent${agents.filter(a => String(a.network_status || a.networkStatus || '').toLowerCase() === 'disconnected').length !== 1 ? 's are' : ' is'} disconnected — these endpoints cannot receive policy updates or threat telemetry.`
            : 'All agents are online.'
          }
        </p>
      </SectionHeader>
      <KpiRow>
        <KpiCard label="Total Agents"     value={agents.length} color="#10b981" />
        <KpiCard label="Connected"        value={agents.filter(a=>String(a.network_status||a.networkStatus||'').toLowerCase()==='connected').length}    color="#22c55e" />
        <KpiCard label="Disconnected"     value={agents.filter(a=>String(a.network_status||a.networkStatus||'').toLowerCase()==='disconnected').length}  color="#ef4444" />
        <KpiCard label="New Agents (30d)" value={newAgents}             color="#6366f1" />
        <KpiCard label="Devices Scanned"  value={agents.length}         color="#0ea5e9" />
        <KpiCard label="Agents Removed"   value={removedAgentsCount ?? 0} color="#dc2626" />
      </KpiRow>

      {agents.length === 0 ? <NoData /> : (
        <ChartRow mb={16}>
          {/* <ChartCard title="Agent Network Status" w={W2}>
            <BarChart width={CW2} height={200} data={statusData} layout="vertical" margin={{ left: 4, right: 36, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TT_STYLE} />
              <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={26} name="Agents">
                {statusData.map((d, i) => <Cell key={i} fill={d.name==='connected'?'#22c55e':d.name==='disconnected'?'#ef4444':COLORS[i%COLORS.length]} />)}
                <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ChartCard> */}

          <ChartCard title="OS Distribution" w={W2}>
            <BarChart width={CW2} height={200} data={osData} layout="vertical" margin={{ left: 4, right: 36, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TT_STYLE} />
              <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={26} name="Agents">
                {osData.map((_, i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ChartCard>
        </ChartRow>
      )}

      {machineTypeData.length > 0 && (
        <ChartRow mb={16}>
          <ChartCard title="Fleet Composition by Machine Type" w={W2}>
            <BarChart width={CW2} height={220} data={machineTypeData} layout="vertical" margin={{ left: 4, right: 36, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TT_STYLE} />
              <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={26} name="Agents">
                {machineTypeData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ChartCard>

          <ChartCard title="Machine Type Breakdown" w={W2}>
            <div style={{ padding: '12px 16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Type', 'Count', 'Share'].map(col => (
                      <th key={col} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', fontSize: 12, letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...machineTypeData].sort((a, b) => b.value - a.value).map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                      <td style={{ padding: '6px 10px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #f3f4f6', textTransform: 'capitalize' }}>{row.name}</td>
                      <td style={{ padding: '6px 10px', color: '#374151', borderBottom: '1px solid #f3f4f6' }}>{row.value}</td>
                      <td style={{ padding: '6px 10px', color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>
                        {agents.length > 0 ? `${Math.round((row.value / agents.length) * 100)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </ChartRow>
      )}

      {agents.length > 0 && (
        <DataTable
          title="Agent Details (Top 10)"
          columns={['computer_name', 'os_type', 'network_status', 'agent_version', 'last_active_date']}
          rows={agents.slice(0, 10).map(a => ({
            computer_name: a.computer_name || a.computerName || '-',
            os_type: a.os_type || a.osType || a.os || '-',
            network_status: a.network_status || a.networkStatus || '-',
            agent_version: a.agent_version || a.agentVersion || '-',
            last_active_date: (() => { const v = a.lastActiveDate || a.last_active_date || a.lastSeen; return v ? new Date(v).toLocaleDateString() : '-'; })(),
          }))}
        />
      )}
    </div>
  );
}

// ── Section 5: Most At-Risk Entities ─────────────────────────────────────────
function MostAtRiskSection({ s1Threats }) {
  const threats = Array.isArray(s1Threats) ? s1Threats : [];

  const { topDevices, topUsers, topGroups, topDevice, topUser, topGroup } = useMemo(() => {
    const byDevice = {}, byUser = {}, byGroup = {};
    threats.forEach(t => {
      const dev = t.agentRealtimeInfo?.agentComputerName;
      const usr = t.threatInfo?.processUser;
      const grp = t.agentRealtimeInfo?.groupName || t.group_name;
      if (dev) byDevice[dev] = (byDevice[dev] || 0) + 1;
      if (usr) byUser[usr]   = (byUser[usr]   || 0) + 1;
      if (grp) byGroup[grp]  = (byGroup[grp]  || 0) + 1;
    });
    const top = obj => Object.entries(obj).sort((a, b) => b[1] - a[1]);
    const toChart = (entries) => entries.slice(0, 5).map(([name, value]) => ({ name: name.length > 22 ? name.slice(0, 22) + '…' : name, value }));
    const devEntries = top(byDevice), usrEntries = top(byUser), grpEntries = top(byGroup);
    return {
      topDevices: toChart(devEntries),
      topUsers:   toChart(usrEntries),
      topGroups:  toChart(grpEntries),
      topDevice:  devEntries[0],
      topUser:    usrEntries[0],
      topGroup:   grpEntries[0],
    };
  }, [threats]);

  if (threats.length === 0) return null;

  const atRiskCards = [
    { label: 'Most At-Risk Device', entry: topDevice, color: '#ef4444' },
    { label: 'Most At-Risk User',   entry: topUser,   color: '#f97316' },
    { label: 'Most At-Risk Group',  entry: topGroup,  color: '#8b5cf6' },
  ];

  return (
    <div data-pdf-section="true" style={{ padding: '24px 32px', background: '#fff', borderTop: '1px solid #f3f4f6' }}>
      <SectionHeader number="5" title="Most At-Risk Entities" color="#f97316">
        <p style={{ fontSize: 13, color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
          Entities most frequently targeted by threats during the report period. Rankings are derived from the total number of threat detections per device, user account, and organisational group.
        </p>
      </SectionHeader>

      <div data-pdf-block="true" style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {atRiskCards.map(({ label, entry, color }) => (
          <div key={label} style={{ flex: '1 1 0', border: '1px solid #e5e7eb', borderLeft: `4px solid ${color}`, borderRadius: 8, padding: '14px 16px', background: '#f8fafc' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
            {entry ? (
              <>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 2, wordBreak: 'break-all' }}>{entry[0]}</div>
                <div style={{ fontSize: 14, color, fontWeight: 600 }}>{entry[1]} threat{entry[1] !== 1 ? 's' : ''}</div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: '#9ca3af' }}>No data</div>
            )}
          </div>
        ))}
      </div>

      <ChartRow mb={0}>
        {[
          { title: 'Top Devices by Threat Count',   data: topDevices, color: '#ef4444' },
          { title: 'Top Users by Threat Count',     data: topUsers,   color: '#f97316' },
          { title: 'Top Groups by Threat Count',    data: topGroups,  color: '#8b5cf6' },
        ].map(({ title, data, color }) => (
          <ChartCard key={title} title={title} w={W3}>
            {data.length === 0 ? <NoData /> : (
              <BarChart width={CW3} height={220} data={data} layout="vertical" margin={{ left: 4, right: 36, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                <Tooltip contentStyle={TT_STYLE} />
                <Bar dataKey="value" fill={color} radius={[0, 3, 3, 0]}>
                  <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
                </Bar>
              </BarChart>
            )}
          </ChartCard>
        ))}
      </ChartRow>
    </div>
  );
}

// ── CVE colour map (mirrors S1Cve.jsx) ───────────────────────────────────────
const CVE_COLORS = { CRITICAL: '#a855f7', HIGH: '#ef4444', MEDIUM: '#eab308', LOW: '#3b82f6', UNKNOWN: '#64748b' };
const SEVER_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];

function shortName(v, max = 18) {
  return v && v.length > max ? v.slice(0, max) + '…' : (v || '');
}

function buildCveData(apps) {
  const sc = (r) => parseFloat(r.baseScore) || 0;

  const appMap = {};
  apps.forEach((r) => {
    const key = r.applicationName || r.application || 'Unknown';
    if (!appMap[key]) appMap[key] = { name: key, vendor: r.applicationVendor || '', cves: new Set(), endpoints: new Set(), severities: [], scores: [], daysDetected: 0 };
    const a = appMap[key];
    if (r.cveId)                      a.cves.add(r.cveId);
    if (r.endpointId || r.endpointName) a.endpoints.add(r.endpointId || r.endpointName);
    if (r.severity)                   a.severities.push(String(r.severity).toUpperCase());
    a.scores.push(sc(r));
    a.daysDetected = Math.max(a.daysDetected, r.daysDetected || 0);
  });

  const appList = Object.values(appMap).map((a) => ({
    name: a.name, vendor: a.vendor,
    cveCount:      a.cves.size,
    endpointCount: a.endpoints.size,
    highestSeverity: SEVER_ORDER.find((s) => a.severities.includes(s)) || 'UNKNOWN',
    highestNvdBaseScore: a.scores.length ? Math.max(...a.scores) : 0,
    daysDetected: a.daysDetected,
  }));

  const totalCves      = new Set(apps.map((r) => r.cveId).filter(Boolean)).size || apps.length;
  const totalEndpoints = new Set(apps.map((r) => r.endpointId || r.endpointName).filter(Boolean)).size;
  const avgScore       = apps.length ? (apps.reduce((s, r) => s + sc(r), 0) / apps.length).toFixed(1) : 0;

  const severityMap = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };
  apps.forEach((r) => { const s = String(r.severity || 'UNKNOWN').toUpperCase(); severityMap[s in severityMap ? s : 'UNKNOWN']++; });

  const severityDistribution = Object.entries(severityMap)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value, fill: CVE_COLORS[name] }));

  const topRiskyApps = [...appList].sort((a, b) => b.cveCount - a.cveCount).slice(0, 10)
    .map((a) => ({ name: shortName(a.name), fullName: a.name, cves: a.cveCount, score: a.highestNvdBaseScore }));

  const agingBuckets = { '0-30': 0, '31-90': 0, '91-180': 0, '180+': 0 };
  apps.forEach((r) => {
    const d = parseInt(r.daysDetected, 10) || 0;
    if (d <= 30) agingBuckets['0-30']++; else if (d <= 90) agingBuckets['31-90']++; else if (d <= 180) agingBuckets['91-180']++; else agingBuckets['180+']++;
  });
  const cveAging = Object.entries(agingBuckets).map(([name, count]) => ({ name, count }));

  const endpointImpact = [...appList].sort((a, b) => b.endpointCount - a.endpointCount).slice(0, 10)
    .map((a) => ({ name: shortName(a.name), endpoints: a.endpointCount }));

  const scoreRangeBuckets = [
    { name: 'Low (0-3.9)', fill: '#3b82f6', count: 0 },
    { name: 'Med (4-6.9)', fill: '#eab308', count: 0 },
    { name: 'High (7-8.9)', fill: '#ef4444', count: 0 },
    { name: 'Crit (9-10)', fill: '#a855f7', count: 0 },
  ];
  apps.forEach((r) => {
    const s = sc(r);
    if (s < 4) scoreRangeBuckets[0].count++; else if (s < 7) scoreRangeBuckets[1].count++; else if (s < 9) scoreRangeBuckets[2].count++; else scoreRangeBuckets[3].count++;
  });
  const scoreRange = scoreRangeBuckets.filter((b) => b.count > 0).map((b) => ({ name: b.name, value: b.count, fill: b.fill }));

  const vendorCounts = {};
  apps.forEach((r) => { const v = r.applicationVendor || ''; if (v) vendorCounts[v] = (vendorCounts[v] || 0) + 1; });
  const vendorRisk = Object.entries(vendorCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([name, cves]) => ({ name: shortName(name), cves, fullName: name }));

  const statusCounts = {};
  apps.forEach((r) => { const s = r.status || 'Unknown'; statusCounts[s] = (statusCounts[s] || 0) + 1; });
  const estimateStatus = Object.entries(statusCounts)
    .map(([name, value], i) => ({ name, value, fill: ['#f97316','#22c55e','#3b82f6','#a855f7'][i % 4] }));

  const criticalApps = appList.filter((a) => a.highestSeverity === 'CRITICAL' && a.name !== 'Microsoft Office Standard 2016')
    .sort((a, b) => b.cveCount - a.cveCount).slice(0, 6);

  return { totalApplications: appList.length, totalCves, totalEndpoints, avgScore, severityMap, severityDistribution, topRiskyApps, cveAging, endpointImpact, scoreRange, vendorRisk, estimateStatus, criticalApps };
}

// ── Section 6: SentinelOne CVEs ───────────────────────────────────────────────
function S1CveSection({ s1Cves }) {
  const apps = Array.isArray(s1Cves) ? s1Cves : [];

  const d = useMemo(() => buildCveData(apps), [apps]);

  if (apps.length === 0) {
    return (
      <div style={{ padding: '24px 32px', background: '#fff', borderTop: '1px solid #f3f4f6' }}>
        <SectionHeader number="6" title="SentinelOne — Application CVEs" color="#8b5cf6" />
        <NoData />
      </div>
    );
  }

  return (
    <div data-pdf-section="true" style={{ padding: '24px 32px', background: '#fff', borderTop: '1px solid #f3f4f6' }}>
      <SectionHeader number="6" title="SentinelOne — Application CVEs" color="#8b5cf6">
        <p style={{ fontSize: 13, color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
          {d.totalApplications} vulnerable application{d.totalApplications !== 1 ? 's' : ''} identified carrying {d.totalCves} CVE{d.totalCves !== 1 ? 's' : ''} across {d.totalEndpoints} endpoint{d.totalEndpoints !== 1 ? 's' : ''}, with an average CVSS base score of {d.avgScore}.{' '}
          {d.severityMap.CRITICAL > 0 ? `${d.severityMap.CRITICAL} application${d.severityMap.CRITICAL !== 1 ? 's carry' : ' carries'} CRITICAL-severity vulnerabilities and should be patched immediately.` : 'No critical-severity applications detected.'}{' '}
          {d.severityMap.HIGH > 0 ? `A further ${d.severityMap.HIGH} application${d.severityMap.HIGH !== 1 ? 's are' : ' is'} rated HIGH.` : ''}
        </p>
      </SectionHeader>

      {/* 7 KPI cards */}
      <KpiRow gap={10} wrap>
        <KpiCard label="Applications"  value={d.totalApplications}    color="#8b5cf6" />
        <KpiCard label="Total CVEs"    value={d.totalCves}            color="#6366f1" />
        <KpiCard label="Critical Apps" value={d.severityMap.CRITICAL} color="#a855f7" />
        <KpiCard label="High Apps"     value={d.severityMap.HIGH}     color="#ef4444" />
        <KpiCard label="Medium Apps"   value={d.severityMap.MEDIUM}   color="#eab308" />
        <KpiCard label="Endpoints"     value={d.totalEndpoints}       color="#3b82f6" />
        <KpiCard label="Avg Score"     value={d.avgScore}             color="#64748b" />
      </KpiRow>

      {/* Row 1: Severity donut + Score range donut */}
      <ChartRow mb={12}>
        <ChartCard title="Severity Distribution" w={W2}>
          <PdfPieChart width={CW2} height={220} data={d.severityDistribution} />
        </ChartCard>

        <ChartCard title="Base Score Range" w={W2}>
          <PdfPieChart width={CW2} height={220} data={d.scoreRange} />
        </ChartCard>
      </ChartRow>

      {/* Row 2: Top risky apps + CVE aging */}
      <ChartRow>
        <ChartCard title="Top 10 Risky Applications (by CVE count)" w={W2}>
          <BarChart width={CW2} height={320} data={d.topRiskyApps} layout="vertical" margin={{ left: 4, right: 36, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis type="number" tick={{ fontSize: 13 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 13 }} width={130} />
            <Tooltip contentStyle={TT_STYLE} />
            <Bar dataKey="cves" fill="#ef4444" radius={[0,3,3,0]} maxBarSize={22} name="CVEs">
              <LabelList dataKey="cves" position="right" style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title="CVE Aging (Days Detected)" w={W2}>
          <BarChart width={CW2} height={320} data={d.cveAging} margin={{ left: 4, right: 16, top: 24, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="name" tick={{ fontSize: 14 }} />
            <YAxis tick={{ fontSize: 13 }} allowDecimals={false} />
            <Tooltip contentStyle={TT_STYLE} />
            <Bar dataKey="count" fill="#38bdf8" radius={[3,3,0,0]} maxBarSize={60} name="Apps">
              <LabelList dataKey="count" position="top" style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ChartCard>
      </ChartRow>

      {/* Row 3: Endpoint impact + Vendor risk */}
      <ChartRow>
        <ChartCard title="Endpoint Impact (Top 10 Apps)" w={W2}>
          <BarChart width={CW2} height={320} data={d.endpointImpact} layout="vertical" margin={{ left: 4, right: 36, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis type="number" tick={{ fontSize: 13 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 13 }} width={130} />
            <Tooltip contentStyle={TT_STYLE} />
            <Bar dataKey="endpoints" fill="#22c55e" radius={[0,3,3,0]} maxBarSize={22} name="Endpoints">
              <LabelList dataKey="endpoints" position="right" style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title="Vendor Risk (CVEs by Vendor)" w={W2}>
          {d.vendorRisk.length === 0 ? <NoData /> : (
            <BarChart width={CW2} height={320} data={d.vendorRisk} layout="vertical" margin={{ left: 4, right: 36, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis type="number" tick={{ fontSize: 13 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 13 }} width={130} />
              <Tooltip contentStyle={TT_STYLE} />
              <Bar dataKey="cves" fill="#f97316" radius={[0,3,3,0]} maxBarSize={22} name="CVEs">
                <LabelList dataKey="cves" position="right" style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          )}
        </ChartCard>
      </ChartRow>

      {/* Row 4: Remediation status donut (full width) */}
      {/* {d.estimateStatus.length > 0 && (
        <div data-pdf-block="true" style={{ marginBottom: 12 }}>
          <ChartCard title="Remediation Status" w={WF}>
            <PdfPieChart width={340} height={280} data={d.estimateStatus} />
          </ChartCard>
        </div>
      )} */}

      {/* CVE Exposure Funnel table */}
      {d.severityDistribution.length > 0 && (
        <div data-pdf-block="true" style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CVE Exposure Funnel</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Severity', 'Unique CVEs', 'Fleet Coverage %'].map(col => (
                  <th key={col} style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', fontSize: 12, letterSpacing: '0.04em', borderBottom: '2px solid #e5e7eb' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.severityDistribution.map((row, i) => {
                const appsForSev = apps.filter(a => String(a.severity || 'UNKNOWN').toUpperCase() === row.name.toUpperCase());
                const cveCount = new Set(appsForSev.map(a => a.cveId).filter(Boolean)).size || appsForSev.length;
                const epCount  = new Set(appsForSev.map(a => a.endpointId || a.endpointName).filter(Boolean)).size;
                const fleetPct = d.totalEndpoints > 0 ? Math.round((epCount / d.totalEndpoints) * 100) : 0;
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                    <td style={{ padding: '6px 12px', fontWeight: 700, borderBottom: '1px solid #f3f4f6', color: CVE_COLORS[row.name] || '#374151' }}>{row.name}</td>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>{cveCount}</td>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>{epCount}</td>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>{fleetPct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Critical apps mini-cards */}
      {d.criticalApps.length > 0 && (
        <div data-pdf-block="true" style={{ marginTop: 4 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Critical Applications</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {d.criticalApps.map((app, i) => (
              <div key={i} style={{ flex: '1 1 0', minWidth: 0, background: '#faf5ff', border: '1px solid #e9d5ff', borderLeft: '4px solid #a855f7', borderRadius: 8, padding: '10px 12px' }}>
                <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={app.name}>{app.name}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 12 }}>
                  <span style={{ color: '#6b7280' }}>Severity</span><span style={{ color: '#a855f7', fontWeight: 700 }}>{app.highestSeverity}</span>
                  <span style={{ color: '#6b7280' }}>CVEs</span><span style={{ fontWeight: 600 }}>{app.cveCount}</span>
                  <span style={{ color: '#6b7280' }}>Score</span><span style={{ fontWeight: 600 }}>{typeof app.highestNvdBaseScore === 'number' ? app.highestNvdBaseScore.toFixed(1) : app.highestNvdBaseScore}</span>
                  <span style={{ color: '#6b7280' }}>Endpoints</span><span style={{ fontWeight: 600 }}>{app.endpointCount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section 7: Application Insights ──────────────────────────────────────────
function ApplicationInsightsSection({ s1AppAgent }) {
  const apps = Array.isArray(s1AppAgent) ? s1AppAgent : [];

  const { totalApps, uniquePublishers, byOs, bySeverity, topApps } = useMemo(() => {
    const appNames    = new Set();
    const publishers  = new Set();
    const osCounts    = {};
    const sevCounts   = {};

    apps.forEach(a => {
      const name = a.applicationName || a.name    || a.appName || 'Unknown';
      const pub  = a.applicationVendor || a.publisher || a.vendor || '';
      const os   = a.osType || a.os || a.operatingSystem || 'Unknown';
      const sev  = String(a.severity || 'Unknown');

      appNames.add(name);
      if (pub) publishers.add(pub);
      osCounts[os]   = (osCounts[os]   || 0) + 1;
      sevCounts[sev] = (sevCounts[sev] || 0) + 1;
    });

    const byOs = Object.entries(osCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));

    const bySeverity = Object.entries(sevCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value, fill: SEV_COLORS[i % SEV_COLORS.length] }));

    const appCountMap = {};
    apps.forEach(a => {
      const name = a.applicationName || a.name || a.appName || 'Unknown';
      appCountMap[name] = (appCountMap[name] || 0) + 1;
    });
    const topApps = Object.entries(appCountMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, installs]) => ({
        name: name.length > 30 ? name.slice(0, 30) + '…' : name,
        installs,
      }));

    return {
      totalApps:        appNames.size,
      uniquePublishers: publishers.size,
      byOs,
      bySeverity,
      topApps,
    };
  }, [apps]);

  return (
    <div data-pdf-section="true" style={{ padding: '24px 32px', background: '#fff', borderTop: '1px solid #f3f4f6' }}>
      <SectionHeader number="7" title="Application Insights — Installed Applications" color="#0ea5e9">
        <p style={{ fontSize: 13, color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
          {totalApps} unique application{totalApps !== 1 ? 's' : ''} installed across {apps.length} endpoint record{apps.length !== 1 ? 's' : ''} from {uniquePublishers} publisher{uniquePublishers !== 1 ? 's' : ''}.
          {apps.length === 0 ? ' Run a sync to populate this section.' : ''}
        </p>
      </SectionHeader>

      {apps.length === 0 ? <NoData /> : (
        <>
          <KpiRow>
            <KpiCard label="Total Applications" value={totalApps}        color="#0ea5e9" sub="unique app names" />
            <KpiCard label="Unique Publishers"   value={uniquePublishers} color="#6366f1" />
            <KpiCard label="Total Records"       value={apps.length}      color="#10b981" sub="install instances" />
          </KpiRow>

          <ChartRow mb={16}>
            <ChartCard title="Applications by OS" w={W2}>
              {byOs.length === 0 ? <NoData /> : (
                <BarChart width={CW2} height={240} data={byOs} layout="vertical" margin={{ left: 4, right: 36, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis type="number" tick={{ fontSize: 13 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={90} />
                  <Tooltip contentStyle={TT_STYLE} />
                  <Bar dataKey="value" fill="#0ea5e9" radius={[0, 3, 3, 0]}>
                    <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              )}
            </ChartCard>

            <ChartCard title="Applications by Severity" w={W2}>
              {bySeverity.length === 0 ? <NoData /> : (
                <BarChart width={CW2} height={200} data={bySeverity} layout="vertical" margin={{ left: 4, right: 36, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TT_STYLE} />
                  <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={26} name="Apps">
                    {bySeverity.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              )}
            </ChartCard>
          </ChartRow>

          {topApps.length > 0 && (
            <div data-pdf-block="true" style={{ marginBottom: 16 }}>
              <ChartCard title="Top Applications by Install Count" w={WF}>
                <BarChart width={CWF} height={Math.max(320, topApps.length * 36)} data={topApps} layout="vertical" margin={{ left: 8, right: 48, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis type="number" tick={{ fontSize: 13 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 13 }} width={280} interval={0} />
                  <Tooltip contentStyle={TT_STYLE} />
                  <Bar dataKey="installs" fill="#6366f1" radius={[0, 3, 3, 0]} maxBarSize={28}>
                    <LabelList dataKey="installs" position="right" style={{ fontSize: 13, fill: '#374151', fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ChartCard>
            </div>
          )}

          <DataTable
            title="Installed Applications (Top 10 by Install Count)"
            columns={['App Name', 'Publisher', 'Version', 'OS', 'Installs']}
            rows={(() => {
              const map = {};
              apps.forEach(a => {
                const name = a.applicationName || a.name || a.appName || 'Unknown';
                if (!map[name]) map[name] = { name, publisher: a.applicationVendor || a.publisher || a.vendor || '-', version: a.applicationVersion || a.version || '-', os: a.osType || a.os || '-', count: 0 };
                map[name].count++;
              });
              return Object.values(map)
                .sort((a, b) => b.count - a.count)
                .slice(0, 10)
                .map(r => ({
                  'App Name':  r.name.slice(0, 40),
                  'Publisher': r.publisher.slice(0, 30),
                  'Version':   r.version,
                  'OS':        r.os,
                  'Installs':  r.count,
                }));
            })()}
          />
        </>
      )}
    </div>
  );
}

// ── Section 8: Zoho Desk ──────────────────────────────────────────────────────
const ZOHO_STATUS_COLORS   = { Open: '#3b82f6', Closed: '#22c55e', 'On Hold': '#f59e0b', Escalated: '#ef4444', 'In Progress': '#8b5cf6', Resolved: '#10b981' };
const ZOHO_PRIORITY_COLORS = { High: '#ef4444', Critical: '#dc2626', Medium: '#f59e0b', Low: '#22c55e' };

function ZohoSection({ zohoTickets }) {
  const tickets = Array.isArray(zohoTickets) ? zohoTickets : [];

  const statusData = useMemo(() => {
    const counts = {};
    tickets.forEach(t => { const s = t.status || 'Unknown'; counts[s] = (counts[s] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [tickets]);

  const priorityData = useMemo(() => {
    const counts = {};
    tickets.forEach(t => { const p = t.priority || 'Unknown'; counts[p] = (counts[p] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [tickets]);

  const open    = tickets.filter(t => t.status === 'Open').length;
  const closed  = tickets.filter(t => t.status === 'Closed').length;
  const highPri = tickets.filter(t => t.priority === 'High').length;

  return (
    <div data-pdf-section="true" style={{ padding: '24px 32px', background: '#fff', borderTop: '1px solid #f3f4f6' }}>
      <SectionHeader number="8" title="Zoho Desk — Support Tickets" color="#f59e0b">
        <p style={{ fontSize: 13, color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
          {tickets.length} support ticket{tickets.length !== 1 ? 's' : ''} recorded.{' '}
          {open > 0 ? `${open} open` : 'No open tickets'}{highPri > 0 ? `, ${highPri} high priority` : ''}.{' '}
          {closed > 0 ? `${closed} closed.` : ''}
        </p>
      </SectionHeader>

      {tickets.length === 0 ? <NoData /> : (
        <>
          <KpiRow>
            <KpiCard label="Total"         value={tickets.length} color="#6366f1" />
            <KpiCard label="Open"          value={open}           color="#3b82f6" />
            <KpiCard label="High Priority" value={highPri}        color="#ef4444" />
            <KpiCard label="Closed"        value={closed}         color="#22c55e" />
          </KpiRow>

          <ChartRow mb={16}>
            <ChartCard title="By Status" w={W2}>
              <BarChart width={CW2} height={240} data={statusData} margin={{ left: 4, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 13 }} />
                <YAxis tick={{ fontSize: 13 }} allowDecimals={false} />
                <Tooltip contentStyle={TT_STYLE} />
                <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={60}>
                  {statusData.map((d, i) => <Cell key={i} fill={ZOHO_STATUS_COLORS[d.name] || COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ChartCard>

            <ChartCard title="By Priority" w={W2}>
              <BarChart width={CW2} height={240} data={priorityData} margin={{ left: 4, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 13 }} />
                <YAxis tick={{ fontSize: 13 }} allowDecimals={false} />
                <Tooltip contentStyle={TT_STYLE} />
                <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={60}>
                  {priorityData.map((d, i) => <Cell key={i} fill={ZOHO_PRIORITY_COLORS[d.name] || COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ChartCard>
          </ChartRow>

          <DataTable
            title="Recent Support Tickets (Top 10)"
            columns={['Subject', 'Status', 'Priority', 'Contact', 'Created']}
            rows={tickets.slice(0, 10).map(t => ({
              'Subject':  (t.subject     || '—').slice(0, 60),
              'Status':   t.status       || '—',
              'Priority': t.priority     || '—',
              'Contact':  t.contact_name || '—',
              'Created':  t.created_time ? new Date(t.created_time).toLocaleDateString() : '—',
            }))}
          />
        </>
      )}
    </div>
  );
}

// ── Section 9: Palo Alto Firewall ─────────────────────────────────────────────
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
    <div data-pdf-section="true" style={{ padding: '24px 32px', background: '#fff', borderTop: '1px solid #f3f4f6' }}>
      <SectionHeader number="9" title="Palo Alto Firewall — Network Security" color="#f97316">
        <p style={{ fontSize: 13, color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
          {hasAnyData
            ? `Firewall telemetry covering inbound threat sessions and top network connections. ${topAttackers.length > 0 ? `${topAttackers.length} distinct attacker source${topAttackers.length !== 1 ? 's' : ''} identified — the most active source is "${topAttackers[0]?.name}" with ${topAttackers[0]?.value} session${topAttackers[0]?.value !== 1 ? 's' : ''}.` : ''} ${riskTrend.length > 0 ? `The risk/session trend covers ${riskTrend.length} day${riskTrend.length !== 1 ? 's' : ''} of data — spikes may indicate active scanning or coordinated attack campaigns.` : ''}`
            : 'No firewall data available. Ensure the Palo Alto integration is configured and data has been synced.'
          }
        </p>
      </SectionHeader>

      {!hasAnyData ? <NoData /> : (
        <>
          <ChartRow mb={16}>
            {riskTrend.length > 0 && (
              <ChartCard title="Risk / Session Trend" w={W2}>
                <LineChart width={CW2} height={280} data={riskTrend} margin={{ left: 4, right: 16, top: 8, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} angle={-30} textAnchor="end" />
                  <YAxis tick={{ fontSize: 13 }} />
                  <Tooltip contentStyle={TT_STYLE} />
                  <Line type="monotone" dataKey="sessions" stroke="#f97316" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartCard>
            )}
            {topAttackers.length > 0 && (
              <ChartCard title="Top Attacker Sources" w={W2}>
                <BarChart width={CW2} height={280} data={topAttackers} layout="vertical" margin={{ left: 4, right: 36, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis type="number" tick={{ fontSize: 13 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 13 }} width={130} />
                  <Tooltip contentStyle={TT_STYLE} />
                  <Bar dataKey="value" fill="#ef4444" radius={[0,3,3,0]}>
                    <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ChartCard>
            )}
          </ChartRow>

          {connTable && connTable.rows.length > 0 && (
            <div data-pdf-block="true">
              <DataTable
                title="Top Connections"
                columns={connTable.columns.slice(0, 6)}
                rows={connTable.rows.slice(0, 8)}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Section 9: Weekly Insights ────────────────────────────────────────────────
const EVENT_TYPE_COLORS_RPT = {
  phishing: '#ef4444', malware: '#f97316', dlp: '#8b5cf6',
  suspicious_phishing: '#f59e0b', suspicious_malware: '#ec4899',
};
const FALLBACK_COLORS_RPT = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#06b6d4'];

// Normalize Postgres timestamp strings like "2026-06-10 17:49:01.168+05:30"
// to ISO 8601 "2026-06-10T17:49:01.168+05:30" so new Date() parses reliably.
function parseTs(v) {
  if (!v) return null;
  const d = new Date(typeof v === 'string' ? v.replace(' ', 'T') : v);
  return isNaN(d.getTime()) ? null : d;
}
function toWDateKey(d) {
  const dt = (d instanceof Date) ? d : parseTs(d);
  if (!dt) return null;
  return dt.toISOString().slice(0, 10);
}

function computeWeeklyStats(harmonyEvents, s1Threats, s1Agents = [], s1Cves = []) {
  const events  = Array.isArray(harmonyEvents) ? harmonyEvents : [];
  const threats = Array.isArray(s1Threats)     ? s1Threats     : [];
  const agents  = Array.isArray(s1Agents)      ? s1Agents      : [];
  const cves    = Array.isArray(s1Cves)        ? s1Cves        : [];

  // Anchor the comparison window to the most recent data date, not today.
  // This ensures charts populate even when data was synced days/weeks ago.
  let anchor = null;
  events.forEach(e => {
    const d = parseTs(e.event_created);
    if (d && (!anchor || d > anchor)) anchor = d;
  });
  threats.forEach(t => {
    const d = parseTs(t.threatInfo?.createdAt);
    if (d && (!anchor || d > anchor)) anchor = d;
  });
  if (!anchor) anchor = new Date();

  // "this period" = 7 days ending at anchor (inclusive)
  const thisEnd = new Date(anchor); thisEnd.setHours(23, 59, 59, 999);
  const thisStart = new Date(thisEnd); thisStart.setDate(thisEnd.getDate() - 6); thisStart.setHours(0, 0, 0, 0);
  // "last period" = the 7 days before thisStart
  const lastEnd   = new Date(thisStart);
  const lastStart = new Date(lastEnd); lastStart.setDate(lastEnd.getDate() - 7);

  // Human-readable labels for the section header
  const fmtDate = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const periodLabel = `${fmtDate(thisStart)} – ${fmtDate(thisEnd)}`;

  const thisWeekEvents  = events.filter(e  => { const d = parseTs(e.event_created);         return d && d >= thisStart && d <= thisEnd; });
  const lastWeekEvents  = events.filter(e  => { const d = parseTs(e.event_created);         return d && d >= lastStart && d < lastEnd; });
  const thisWeekThreats = threats.filter(t => { const d = parseTs(t.threatInfo?.createdAt); return d && d >= thisStart && d <= thisEnd; });
  const lastWeekThreats = threats.filter(t => { const d = parseTs(t.threatInfo?.createdAt); return d && d >= lastStart && d < lastEnd; });

  // severity is stored as a number (e.g. 3, 4) in checkpoint_events
  const sevLabel = (s) => {
    const n = Number(s);
    if (isNaN(n)) return String(s || 'unknown').toLowerCase();
    if (n >= 4) return 'critical';
    if (n === 3) return 'high';
    if (n === 2) return 'medium';
    return 'low';
  };

  const remStates = ['remediated', 'closed', 'done'];
  const thisRem = thisWeekEvents.filter(e => remStates.includes(e.state)).length;
  const lastRem = lastWeekEvents.filter(e => remStates.includes(e.state)).length;
  const thisCrit = thisWeekEvents.filter(e => { const n = Number(e.severity); return !isNaN(n) && n >= 3; }).length;
  const lastCrit = lastWeekEvents.filter(e => { const n = Number(e.severity); return !isNaN(n) && n >= 3; }).length;

  // 14-day buckets ending at thisEnd
  const last14 = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(thisEnd); d.setDate(thisEnd.getDate() - i); d.setHours(12, 0, 0, 0);
    last14.push({ key: toWDateKey(d), label: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) });
  }

  const eventTypesSet = new Set();
  const eventByDay = {};
  last14.forEach(({ key, label }) => { eventByDay[key] = { date: label }; });
  events.forEach(e => {
    if (!e.event_created) return;
    const k = toWDateKey(e.event_created);
    if (!eventByDay[k]) return;
    const type = e.type || 'unknown'; eventTypesSet.add(type);
    eventByDay[k][type] = (eventByDay[k][type] || 0) + 1;
  });
  const trend14dEvents = last14.map(({ key }) => eventByDay[key]);
  const eventTypes = [...eventTypesSet];

  const threatByDay = {};
  last14.forEach(({ key, label }) => { threatByDay[key] = { date: label, detected: 0, mitigated: 0 }; });
  threats.forEach(t => {
    const k = t.threatInfo?.createdAt ? toWDateKey(t.threatInfo.createdAt) : null;
    if (!k || !threatByDay[k]) return;
    threatByDay[k].detected++;
    if (t.threatInfo?.mitigationStatus === 'mitigated') threatByDay[k].mitigated++;
  });
  const trend14dThreats = last14.map(({ key }) => threatByDay[key]);

  // 7-day daily WoW comparison (anchored to thisEnd)
  const remComp = [];
  for (let i = 6; i >= 0; i--) {
    const td = new Date(thisEnd); td.setDate(thisEnd.getDate() - i); td.setHours(12, 0, 0, 0);
    const tk = toWDateKey(td);
    const ld = new Date(td); ld.setDate(ld.getDate() - 7);
    const lk = toWDateKey(ld);
    remComp.push({
      day: td.toLocaleDateString('en-GB', { weekday: 'short' }),
      'This Week': thisWeekEvents.filter(e => e.event_created && toWDateKey(e.event_created) === tk).length,
      'Last Week': lastWeekEvents.filter(e => e.event_created && toWDateKey(e.event_created) === lk).length,
    });
  }

  // Severity shift — map numeric severity to labels first
  const sevLevels = ['critical', 'high', 'medium', 'low'];
  const severityShift = sevLevels.map(sev => ({
    severity: sev.charAt(0).toUpperCase() + sev.slice(1),
    thisWeek: thisWeekEvents.filter(e => sevLabel(e.severity) === sev).length,
    lastWeek: lastWeekEvents.filter(e => sevLabel(e.severity) === sev).length,
  })).filter(d => d.thisWeek > 0 || d.lastWeek > 0);

  // Top senders
  const sThis = {}, sLast = {};
  thisWeekEvents.forEach(e => { const s = e.sender_address || 'Unknown'; sThis[s] = (sThis[s] || 0) + 1; });
  lastWeekEvents.forEach(e => { const s = e.sender_address || 'Unknown'; sLast[s] = (sLast[s] || 0) + 1; });
  const topSenders = Object.entries(sThis).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([s, tw]) => ({ sender_address: s.length > 45 ? s.slice(0, 45) + '…' : s, 'This Week': tw, 'Last Week': sLast[s] || 0, Change: tw - (sLast[s] || 0) }));

  // Top endpoints
  const getEp = t => t.agentRealtimeInfo?.agentComputerName || t.agentDetectionInfo?.agentComputerName || '';
  const epThis = {}, epLast = {};
  thisWeekThreats.forEach(t => { const ep = getEp(t); if (ep) epThis[ep] = (epThis[ep] || 0) + 1; });
  lastWeekThreats.forEach(t => { const ep = getEp(t); if (ep) epLast[ep] = (epLast[ep] || 0) + 1; });
  const topEndpoints = Object.entries(epThis).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([ep, tw]) => ({ endpoint: ep.length > 40 ? ep.slice(0, 40) + '…' : ep, 'This Week': tw, 'Last Week': epLast[ep] || 0 }));

  // New vs recurring
  const thisNames = new Set(thisWeekThreats.map(t => t.threatInfo?.threatName).filter(Boolean));
  const lastNames = new Set(lastWeekThreats.map(t => t.threatInfo?.threatName).filter(Boolean));
  const newCount  = [...thisNames].filter(n => !lastNames.has(n)).length;
  const recCount  = [...thisNames].filter(n =>  lastNames.has(n)).length;
  const newVsRecurring = [
    { name: 'New', value: newCount, fill: '#ef4444' },
    { name: 'Recurring', value: recCount, fill: '#f97316' },
  ].filter(d => d.value > 0);

  // Top users by threat count this week vs last
  const getUser = t => t.threatInfo?.initiatingUsername || t.threatInfo?.processUser || t.agentDetectionInfo?.agentLastLoggedInUserName || '';
  const userThis = {}, userLast = {};
  thisWeekThreats.forEach(t => { const u = getUser(t); if (u) userThis[u] = (userThis[u] || 0) + 1; });
  lastWeekThreats.forEach(t => { const u = getUser(t); if (u) userLast[u] = (userLast[u] || 0) + 1; });
  const topUsers = Object.entries(userThis).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([u, tw]) => ({ user: u.length > 40 ? u.slice(0, 40) + '…' : u, 'This Week': tw, 'Last Week': userLast[u] || 0 }));

  // New agents enrolled this week vs last
  const getAgentDate = a => a.registeredAt || a.createdAt || a.registered_at || a.created_at;
  const newAgentsThis = agents.filter(a => { const d = parseTs(getAgentDate(a)); return d && d >= thisStart && d <= thisEnd; }).length;
  const newAgentsLast = agents.filter(a => { const d = parseTs(getAgentDate(a)); return d && d >= lastStart && d < lastEnd; }).length;

  // CVEs use daysDetected (integer) rather than a timestamp.
  // daysDetected <= 7  → appeared this week; 8–14 → appeared last week.
  const inCveWindowThis = c => { const n = Number(c.daysDetected); return !isNaN(n) && n >= 0 && n <= 7; };
  const inCveWindowLast = c => { const n = Number(c.daysDetected); return !isNaN(n) && n > 7 && n <= 14; };
  const newCvesThis  = cves.filter(inCveWindowThis).length;
  const newCvesLast  = cves.filter(inCveWindowLast).length;
  const critCvesThis = cves.filter(c => inCveWindowThis(c) && (String(c.severity || '').toUpperCase() === 'CRITICAL' || Number(c.baseScore) >= 9)).length;

  // MTTD trend — avg minutes from identifiedAt to createdAt, per day over last 14 days
  const mttdMap = {};
  last14.forEach(({ key }) => { mttdMap[key] = { sum: 0, count: 0 }; });
  threats.forEach(t => {
    const created    = parseTs(t.threatInfo?.createdAt);
    const identified = parseTs(t.threatInfo?.identifiedAt);
    if (!created || !identified) return;
    const k = toWDateKey(created);
    if (!mttdMap[k]) return;
    mttdMap[k].sum   += (created - identified) / 60000;
    mttdMap[k].count += 1;
  });
  const mttdTrend = last14
    .map(({ key, label }) => mttdMap[key]?.count > 0 ? { date: label, avg: Math.round(mttdMap[key].sum / mttdMap[key].count) } : null)
    .filter(Boolean);

  // MTTM trend — avg minutes from identifiedAt to mitigationEndedAt, per day over last 14 days
  const mttmMap = {};
  last14.forEach(({ key }) => { mttmMap[key] = { sum: 0, count: 0 }; });
  threats.forEach(t => {
    const identified   = parseTs(t.threatInfo?.identifiedAt);
    const successEntry = (t.mitigationStatus || []).find(s => s.status === 'success');
    if (!identified || !successEntry) return;
    const ended = parseTs(successEntry.mitigationEndedAt);
    if (!ended) return;
    const k = toWDateKey(identified);
    if (!mttmMap[k]) return;
    mttmMap[k].sum   += (ended - identified) / 60000;
    mttmMap[k].count += 1;
  });
  const mttmTrend = last14
    .map(({ key, label }) => mttmMap[key]?.count > 0 ? { date: label, avg: Math.round(mttmMap[key].sum / mttmMap[key].count) } : null)
    .filter(Boolean);

  return {
    kpi: {
      harmonyThis: thisWeekEvents.length,  harmonyLast: lastWeekEvents.length,
      threatsThis: thisWeekThreats.length, threatsLast: lastWeekThreats.length,
      remRateThis: thisWeekEvents.length > 0 ? Math.round((thisRem / thisWeekEvents.length) * 100) : 0,
      remRateLast: lastWeekEvents.length > 0 ? Math.round((lastRem / lastWeekEvents.length) * 100) : 0,
      critThis: thisCrit, critLast: lastCrit,
      newAgentsThis, newAgentsLast,
      newCvesThis, newCvesLast, critCvesThis,
    },
    periodLabel,
    trend14dEvents, eventTypes, trend14dThreats, remComp, severityShift,
    topSenders, topEndpoints, topUsers, newVsRecurring, thisNameCount: thisNames.size, newCount,
    mttdTrend, mttmTrend,
  };
}

function WowKpiCard({ label, thisWeek, lastWeek, unit = '', higherIsBetter = false }) {
  const change = lastWeek === 0 && thisWeek === 0 ? null
    : lastWeek === 0 ? 100
    : Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  const improved = change === null ? null : higherIsBetter ? change >= 0 : change <= 0;
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', flex: '1 1 0', minWidth: 120 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 2 }}>
        <div style={{ fontSize: 30, fontWeight: 800, color: '#111827' }}>{thisWeek}{unit}</div>
        {change !== null && (
          <span style={{
            fontSize: 12, fontWeight: 700, padding: '2px 6px', borderRadius: 9999, marginBottom: 3,
            background: improved ? '#dcfce7' : '#fee2e2',
            color:      improved ? '#166534' : '#991b1b',
          }}>
            {change > 0 ? '▲' : change < 0 ? '▼' : '—'} {Math.abs(change)}%
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: '#9ca3af' }}>vs {lastWeek}{unit} last 7 days</div>
    </div>
  );
}

const SUB_HEADER_STYLE = {
  fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
  marginBottom: 12, marginTop: 4, paddingBottom: 6, borderBottom: '1px solid #e5e7eb',
};

function WeeklyInsightsSection({ harmonyEvents, s1Threats, s1Agents, s1Cves }) {
  const d = useMemo(
    () => computeWeeklyStats(harmonyEvents, s1Threats, s1Agents, s1Cves),
    [harmonyEvents, s1Threats, s1Agents, s1Cves],
  );
  const hasThreats = Array.isArray(s1Threats) && s1Threats.length > 0;

  return (
    <div data-pdf-section="true" style={{ padding: '24px 32px', background: '#fff', borderTop: '1px solid #f3f4f6' }}>
      <SectionHeader number="W" title="Weekly Insights — 7-Day Comparison" color="#7c3aed">
        <p style={{ fontSize: 13, color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
          Week-over-week comparison anchored to the most recent data date.{' '}
          Covers S1 Threats, Agents, Most At-Risk endpoints, Application CVEs etc..
        </p>
      </SectionHeader>

      <div data-pdf-block="true" style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, padding: '8px 14px', marginBottom: 20 }}>
        <p style={{ margin: 0, fontSize: 13, color: '#5b21b6' }}>
          <strong>Period:</strong> {d.periodLabel} &nbsp;·&nbsp; Compared against the preceding 7 days. All data anchored to the latest available sync date.
        </p>
      </div>

      {/* ── S1 Threats ── */}
      <div data-pdf-block="true" style={{ marginBottom: 20 }}>
        <p style={{ ...SUB_HEADER_STYLE, color: '#ef4444' }}>S1 Threats</p>
        <KpiRow mb={12}>
          <WowKpiCard label="Threats Detected"   thisWeek={d.kpi.threatsThis} lastWeek={d.kpi.threatsLast} higherIsBetter={false} />
        </KpiRow>
        {hasThreats && (
          <ChartCard title="14-Day Threat Detection vs Mitigation" w={WF}>
            <ComposedChart width={CWF} height={220} data={d.trend14dThreats} margin={{ left: 4, right: 8, top: 8, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip contentStyle={TT_STYLE} />
              <Legend iconSize={9} wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="detected"  stroke="#ef4444" strokeWidth={2} fill="#fee2e2" dot={false} name="Detected" />
              <Line type="monotone" dataKey="mitigated" stroke="#10b981" strokeWidth={2} dot={false} name="Mitigated" />
            </ComposedChart>
          </ChartCard>
        )}
        {(d.mttdTrend.length > 0 || d.mttmTrend.length > 0) && (
          <ChartRow mb={0}>
            <ChartCard title="MTTD Trend (14 days)" w={W2}
              description="Mean time to detect — minutes from threat identification to creation timestamp, per day.">
              {d.mttdTrend.length === 0 ? <NoData /> : (
                <LineChart width={CW2} height={220} data={d.mttdTrend} margin={{ left: 4, right: 16, top: 8, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v < 60 ? `${v}m` : `${Math.floor(v/60)}h`} />
                  <Tooltip contentStyle={TT_STYLE} formatter={v => [`${v}m`, 'Avg MTTD']} />
                  <Line type="monotone" dataKey="avg" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="Avg MTTD" />
                </LineChart>
              )}
            </ChartCard>
            <ChartCard title="MTTM Trend (14 days)" w={W2}
              description="Mean time to mitigate — minutes from identification to successful mitigation, per day.">
              {d.mttmTrend.length === 0 ? <NoData /> : (
                <LineChart width={CW2} height={220} data={d.mttmTrend} margin={{ left: 4, right: 16, top: 8, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v < 60 ? `${v}m` : `${Math.floor(v/60)}h`} />
                  <Tooltip contentStyle={TT_STYLE} formatter={v => [`${v}m`, 'Avg MTTM']} />
                  <Line type="monotone" dataKey="avg" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} name="Avg MTTM" />
                </LineChart>
              )}
            </ChartCard>
          </ChartRow>
        )}
      </div>

      <div style={{ height: 16 }} />

      {/* ── S1 Agents ── */}
      <div data-pdf-section="true" style={{ marginBottom: 20 }}>
        <p style={{ ...SUB_HEADER_STYLE, color: '#6366f1' }}>S1 Agents</p>
        <KpiRow mb={0}>
          <WowKpiCard label="New Agents Enrolled" thisWeek={d.kpi.newAgentsThis} lastWeek={d.kpi.newAgentsLast} higherIsBetter={true} />
        </KpiRow>
      </div>

      {/* ── Most At-Risk ── */}
      <div data-pdf-block="true" style={{ marginBottom: 20 }}>
        <p style={{ ...SUB_HEADER_STYLE, color: '#f97316' }}>Most At-Risk</p>
        <ChartRow mb={0}>
          {d.topEndpoints.length > 0 ? (
            <ChartCard title="Top Endpoints by Threat Count" w={W2}>
              <DataTable
                columns={['endpoint', 'This Week', 'Last Week']}
                rows={d.topEndpoints}
                maxRows={5}
              />
            </ChartCard>
          ) : (
            <ChartCard title="Top Endpoints by Threat Count" w={W2}><NoData /></ChartCard>
          )}
          {d.topUsers.length > 0 ? (
            <ChartCard title="Top Users by Threat Count" w={W2}>
              <DataTable
                columns={['user', 'This Week', 'Last Week']}
                rows={d.topUsers}
                maxRows={5}
              />
            </ChartCard>
          ) : (
            <ChartCard title="Top Users by Threat Count" w={W2}><NoData /></ChartCard>
          )}
        </ChartRow>
      </div>

      {/* ── Application CVEs ── */}
      <div data-pdf-block="true" style={{ marginBottom: 20 }}>
        <p style={{ ...SUB_HEADER_STYLE, color: '#dc2626' }}>Application CVEs</p>
        <KpiRow mb={0}>
          <WowKpiCard label="New CVEs (last 7 days)"      thisWeek={d.kpi.newCvesThis}   lastWeek={d.kpi.newCvesLast}   higherIsBetter={false} />
          <WowKpiCard label="Critical (last 7 days)"    thisWeek={d.kpi.critCvesThis}  lastWeek={0}                   higherIsBetter={false} />
        </KpiRow>
      </div>

      {/* ── Application Insights ── */}
      {/* <div data-pdf-block="true">
        <p style={{ ...SUB_HEADER_STYLE, color: '#0ea5e9' }}>Application Insights</p>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
          Installed application records do not carry weekly installation timestamps — week-over-week comparison is not available for this section.
        </p>
      </div> */}
    </div>
  );
}

// ── Section 10: Open Action Items ─────────────────────────────────────────────
function OpenActionSection({ s1Threats, s1Agents, s1Cves }) {
  const threats = Array.isArray(s1Threats) ? s1Threats : [];
  const agents  = Array.isArray(s1Agents)  ? s1Agents  : [];
  const apps    = Array.isArray(s1Cves)    ? s1Cves    : [];

  const items = [];

  const offlineAgents = agents.filter(a => String(a.network_status || a.networkStatus || '').toLowerCase() === 'disconnected');
  if (offlineAgents.length > 0) {
    items.push({ priority: 'HIGH', category: 'Agent Connectivity', count: offlineAgents.length, action: `${offlineAgents.length} agent(s) offline — verify connectivity and re-register if needed.` });
  }

  const fwDisabled = agents.filter(a => (a.firewall_enabled === false || a.firewallEnabled === false));
  if (fwDisabled.length > 0) {
    items.push({ priority: 'HIGH', category: 'Firewall Config', count: fwDisabled.length, action: `${fwDisabled.length} endpoint(s) have agent firewall disabled — re-enable policy immediately.` });
  }

  const outdated = agents.filter(a => (a.is_up_to_date === false || a.isUpToDate === false || a.outdated === true));
  if (outdated.length > 0) {
    items.push({ priority: 'MEDIUM', category: 'Agent Version', count: outdated.length, action: `${outdated.length} agent(s) are running outdated versions — trigger upgrade via SentinelOne console.` });
  }

  const unmitigatedBackdoor = threats.filter(t =>
    (t.threatInfo?.classification || '').toLowerCase().includes('backdoor') &&
    t.threatInfo?.mitigationStatus !== 'mitigated'
  );
  if (unmitigatedBackdoor.length > 0) {
    items.push({ priority: 'CRITICAL', category: 'Active Backdoor', count: unmitigatedBackdoor.length, action: `${unmitigatedBackdoor.length} unmitigated backdoor threat(s) — isolate affected endpoints and investigate immediately.` });
  }

  const unmitigatedRansomware = threats.filter(t =>
    (t.threatInfo?.classification || '').toLowerCase().includes('ransomware') &&
    t.threatInfo?.mitigationStatus !== 'mitigated'
  );
  if (unmitigatedRansomware.length > 0) {
    items.push({ priority: 'CRITICAL', category: 'Ransomware', count: unmitigatedRansomware.length, action: `${unmitigatedRansomware.length} unmitigated ransomware threat(s) — initiate incident response immediately.` });
  }

  const now = Date.now();
  const staleCves = apps.filter(a => {
    const sev = (a.highestSeverity || '').toUpperCase();
    if (!['CRITICAL', 'HIGH'].includes(sev)) return false;
    const detectedAt = a.detectedAt || a.firstDetected || a.createdAt;
    if (!detectedAt) return false;
    return (now - new Date(detectedAt).getTime()) > 180 * 24 * 3600 * 1000;
  });
  if (staleCves.length > 0) {
    items.push({ priority: 'HIGH', category: 'Stale CVEs', count: staleCves.length, action: `${staleCves.length} critical/high-severity app(s) unpatched for >180 days — prioritise remediation or accept risk formally.` });
  }

  const PRIORITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const PRIORITY_COLOR = { CRITICAL: '#dc2626', HIGH: '#ea580c', MEDIUM: '#ca8a04', LOW: '#16a34a' };
  items.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));

  if (items.length === 0) return null;

  return (
    <div data-pdf-section="true" style={{ padding: '24px 32px', background: '#fff', borderTop: '1px solid #f3f4f6' }}>
      <SectionHeader number="11" title="Open Action Items" color="#dc2626">
        <p style={{ fontSize: 13, color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
          {items.length} open action item{items.length !== 1 ? 's' : ''} identified across endpoint protection, agent health, and vulnerability management.{' '}
          {items.filter(i => i.priority === 'CRITICAL').length > 0
            ? `${items.filter(i => i.priority === 'CRITICAL').length} item${items.filter(i => i.priority === 'CRITICAL').length !== 1 ? 's are' : ' is'} CRITICAL and require immediate escalation.`
            : 'No critical-priority items at this time.'
          }{' '}
          Address all HIGH and CRITICAL items before the next reporting cycle.
        </p>
      </SectionHeader>
      <div data-pdf-block="true">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Priority', 'Category', 'Count', 'Required Action'].map(col => (
                <th key={col} style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', fontSize: 12, letterSpacing: '0.04em', borderBottom: '2px solid #e5e7eb' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '7px 12px', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ background: PRIORITY_COLOR[item.priority], color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{item.priority}</span>
                </td>
                <td style={{ padding: '7px 12px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #f3f4f6' }}>{item.category}</td>
                <td style={{ padding: '7px 12px', color: '#374151', borderBottom: '1px solid #f3f4f6', fontWeight: 700 }}>{item.count}</td>
                <td style={{ padding: '7px 12px', color: '#374151', borderBottom: '1px solid #f3f4f6' }}>{item.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────
function ReportFooter({ orgName, generatedAt }) {
  return (
    <div data-pdf-footer="true" style={{ background: '#1e1b4b', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <p style={{ margin: 0, fontSize: 12, color: '#a5b4fc' }}>CISO Dashboard — {orgName}</p>
      <p style={{ margin: 0, fontSize: 12, color: '#a5b4fc' }}>Generated {new Date(generatedAt).toLocaleString()}</p>
    </div>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────
export default function ReportDocument({ data }) {
  if (!data) return null;
  const { orgName, generatedAt, s1Threats, s1Agents, s1Cves, harmonyEvents,
          fwRiskRaw, fwAttackersRaw, fwConnectionsRaw,
          s1AppAgent, removedAgentsCount, zohoTickets } = data;

  const groups = useMemo(() =>
    [...new Set((s1Agents || []).map(a => a.groupName || a.group?.name || a.siteName).filter(Boolean))],
    [s1Agents]
  );

  const weeklyStats = useMemo(() => computeWeeklyStats(harmonyEvents, s1Threats, s1Agents, s1Cves), [harmonyEvents, s1Threats, s1Agents, s1Cves]);

  return (
    <div style={{ width: 1400, background: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#111827' }}>
      <CoverPage orgName={orgName} generatedAt={generatedAt} groups={groups} />
      <SectionCoverPage number={1} title="Checkpoint Harmony" color="#2563eb" logo={checkpointLogo} logoLabel="Import Checkpoint logo"
        subtitle="Email and cloud security telemetry — threat detection, event monitoring, remediation status, and week-over-week volume analysis across all connected mail and cloud platforms." />
      <CheckpointSection harmonyEvents={harmonyEvents} weeklyStats={weeklyStats} />

      <SectionCoverPage number={2} title="SentinelOne" color="#ef4444" logo={sentinelOneLogo} logoLabel="Import SentinelOne logo"
        subtitle="Endpoint protection across threat detection, agent health, at-risk entities, application vulnerabilities, and installed software — powered by SentinelOne." />
      <S1ThreatsSection s1Threats={s1Threats} />
      <S1AgentsSection s1Agents={s1Agents} generatedAt={generatedAt} removedAgentsCount={removedAgentsCount} />
      <MostAtRiskSection s1Threats={s1Threats} />
      <S1CveSection s1Cves={s1Cves} />
      <ApplicationInsightsSection s1AppAgent={s1AppAgent} />

      <WeeklyInsightsSection harmonyEvents={harmonyEvents} s1Threats={s1Threats} s1Agents={s1Agents} s1Cves={s1Cves} />

      <SectionCoverPage number={3} title="Zoho Desk" color="#f59e0b" logo={zohoLogo} logoLabel="Import Zoho logo"
        subtitle="Support ticket management and helpdesk operations — open ticket volume, priority distribution, resolution rates, and recent ticket activity across the organisation's helpdesk queue." />
      <ZohoSection zohoTickets={zohoTickets} />

      <SectionCoverPage number={4} title="Palo Alto Firewall" color="#f97316" logo={paloAltoLogo} logoLabel="Import Palo Alto logo"
        subtitle="Network security telemetry from the Palo Alto perimeter firewall — inbound threat session trends, top attacker source analysis, and significant connection activity over the reporting period." />
      <FirewallSection fwRiskRaw={fwRiskRaw} fwAttackersRaw={fwAttackersRaw} fwConnectionsRaw={fwConnectionsRaw} />

      <SectionCoverPage number={5} title="Open Action Items" color="#dc2626"
        subtitle="Priority-ranked remediation tasks requiring immediate follow-up — offline agents, firewall policy violations, unmitigated threats, outdated agent versions, and long-standing unpatched vulnerabilities."
        logoLabel="No logo required" />
      <OpenActionSection s1Threats={s1Threats} s1Agents={s1Agents} s1Cves={s1Cves} />
      <ReportFooter orgName={orgName} generatedAt={generatedAt} />
    </div>
  );
}
