// ── Constants ──────────────────────────────────────────────────────────────────

export const FIREWALL_REPORTS = [
  'bandwidth-trend', 'blocked-credential-post', 'hruser-top-applications',
  'hruser-top-threats', 'hruser-top-url-categories', 'risk-trend', 'risky-users',
  'spyware-infected-hosts', 'threat-trend', 'top-application-categories',
  'top-applications', 'top-attacker-destinations', 'top-attacker-sources',
  'top-attackers-by-destination-countries', 'top-attacks', 'top-blocked-url-categories',
  'top-blocked-url-user-behavior', 'top-blocked-url-users', 'top-blocked-websites',
  'top-connections', 'top-denied-applications', 'top-denied-destinations',
  'top-denied-sources', 'top-destination-countries', 'top-destinations',
  'top-http-applications', 'top-source-countries', 'top-sources', 'top-spyware-threats',
  'top-technology-categories', 'top-url-categories', 'top-url-user-behavior',
  'top-url-users', 'top-users', 'top-victim-destinations', 'top-victim-sources',
  'top-victims-by-destination-countries', 'top-viruses', 'top-vulnerabilities', 'top-websites',
];

export const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1'];

export const GRID_BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
export const GRID_COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };

export const DEFAULT_BOXES = [
  { i: 's1-mitigation',    x: 0, y: 0,  w: 3, h: 33 },
  { i: 's1-severity',      x: 3, y: 0,  w: 3, h: 33 },
  { i: 's1-threats',       x: 6, y: 0,  w: 3, h: 33 },
  { i: 's1-agents',        x: 9, y: 0,  w: 3, h: 33 },
  { i: 's1-app-agent',     x: 0, y: 33, w: 3, h: 33 },
  { i: 's1-app-cve',       x: 3, y: 33, w: 3, h: 33 },
  { i: 's1-device-control',x: 6, y: 33, w: 3, h: 33 },
  { i: 's1-rss',           x: 9, y: 33, w: 3, h: 33 },
  { i: 'fw-explorer',      x: 0, y: 0,  w: 7, h: 44 },
];

const ALL_EVENT_TYPES = ['phishing', 'malware', 'dlp', 'suspicious_phishing', 'suspicious_malware'];

export const WIDGET_OPTIONS = [
  { id: 'cp-phishing',   label: 'Phishing',             description: 'Phishing event summary card',          eventTypes: ['phishing'] },
  { id: 'cp-malware',    label: 'Malware',               description: 'Malware event summary card',           eventTypes: ['malware'] },
  { id: 'cp-dlp',        label: 'DLP',                   description: 'Data loss prevention event card',      eventTypes: ['dlp'] },
  { id: 'cp-susp-phish', label: 'Suspicious Phishing',   description: 'Suspicious phishing event card',       eventTypes: ['suspicious_phishing'] },
  { id: 'cp-susp-mal',   label: 'Suspicious Malware',    description: 'Suspicious malware event card',        eventTypes: ['suspicious_malware'] },
  { id: 'cp-all',        label: 'All Events',            description: 'Combined summary of all event types',  eventTypes: ALL_EVENT_TYPES },
];

export const S1_WIDGET_DEFS = [
  { id: 's1-mitigation',    label: 'Mitigation Status',  description: 'Donut / bar / % chart of threat mitigation statuses', defaultViewMode: 'stat' },
  { id: 's1-severity',      label: 'Threat Severity',    description: 'Horizontal bar chart by confidence level',            defaultViewMode: 'stat' },
  { id: 's1-threats',       label: 'Recent Threats',     description: 'Table of 15 most recent threats',                     defaultViewMode: 'table' },
  { id: 's1-agents',        label: 'Agent Status',       description: 'Table of all agents with active/inactive status',     defaultViewMode: 'table' },
  { id: 's1-app-agent',     label: 'Application Agents', description: 'Configurable table or graph of app-agent records',    defaultViewMode: 'table' },
  { id: 's1-app-cve',       label: 'Application CVEs',   description: 'Configurable table or graph of CVE records',          defaultViewMode: 'table' },
  { id: 's1-device-control',label: 'Device Control',     description: 'Configurable table or graph of device-control events',defaultViewMode: 'table' },
  { id: 's1-rss',           label: 'RSS Feed',           description: 'SentinelOne RSS security news feed',                  defaultViewMode: 'table' },
];

// ── Grid layout helpers ────────────────────────────────────────────────────────

export function clampLayoutItem(item, cols) {
  const w = Math.max(1, Math.min(Number(item.w) || 1, cols));
  const x = Math.max(0, Math.min(Number(item.x) || 0, cols - w));
  return { ...item, x, y: Math.max(0, Number(item.y) || 0), w, h: Math.max(1, Number(item.h) || 1) };
}

export function normalizeSavedBoxes(saved = []) {
  return DEFAULT_BOXES.map((def) => {
    const savedBox = saved.find((b) => b.i === def.i);
    return clampLayoutItem({ ...def, ...(savedBox || {}) }, GRID_COLS.lg);
  });
}

function stackLayout(items, cols) {
  let y = 0;
  return items.map((item) => {
    const h = Math.max(1, Number(item.h) || 1);
    const next = { ...item, x: 0, y, w: cols, h };
    y += h;
    return next;
  });
}

export function clampGridItem(item, cols) {
  const w = Math.max(Number(item.minW) || 1, Math.min(Number(item.w) || 1, cols));
  const x = Math.max(0, Math.min(Number(item.x) || 0, cols - w));
  return { ...item, x, w };
}

export function makeResponsiveLayouts(items) {
  return {
    lg:  items.map((item) => clampGridItem(item, GRID_COLS.lg)),
    md:  items.map((item) => clampGridItem(item, GRID_COLS.md)),
    sm:  stackLayout(items, GRID_COLS.sm),
    xs:  stackLayout(items, GRID_COLS.xs),
    xxs: stackLayout(items, GRID_COLS.xxs),
  };
}

// ── Firewall axis helpers ──────────────────────────────────────────────────────

export function parseAxis(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try {
    const p = JSON.parse(v);
    return Array.isArray(p) ? p : [String(v)];
  } catch {
    return String(v).split(',').map((s) => s.trim()).filter(Boolean);
  }
}

// ── Numeric formatters ─────────────────────────────────────────────────────────

export function getNum(v) {
  if (v == null || v === '') return 0;
  const n = Number(String(v).replace(/,/g, '').replace(/[^\d.]/g, ''));
  return isNaN(n) ? 0 : n;
}

export function parseN(v) {
  if (v == null || v === '') return 0;
  const s = String(v).replace(/,/g, '').trim().toLowerCase();
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  if (s.includes('tb')) return n * 1e12;
  if (s.includes('gb')) return n * 1e9;
  if (s.includes('mb')) return n * 1e6;
  if (s.includes('kb')) return n * 1e3;
  return n;
}

export function fmtBytes(b) {
  if (!b || isNaN(b)) return '0';
  if (b >= 1e12) return (b / 1e12).toFixed(2) + ' TB';
  if (b >= 1e9)  return (b / 1e9).toFixed(2)  + ' GB';
  if (b >= 1e6)  return (b / 1e6).toFixed(2)  + ' MB';
  if (b >= 1e3)  return (b / 1e3).toFixed(2)  + ' KB';
  return b + ' B';
}

export function fmtBytesShort(b) {
  if (!b || isNaN(b)) return '0';
  if (b >= 1e12) return `${(b / 1e12).toFixed(1)}T`;
  if (b >= 1e9)  return `${(b / 1e9).toFixed(1)}G`;
  if (b >= 1e6)  return `${(b / 1e6).toFixed(1)}M`;
  if (b >= 1e3)  return `${(b / 1e3).toFixed(1)}K`;
  return String(b);
}

export function fmtCell(col, val) {
  if (val == null || val === '') return '—';
  const s = String(val);
  if (col.includes('time') || col.includes('date')) {
    const ts = Number(val);
    if (!isNaN(ts) && ts > 1_000_000_000) return new Date(ts * 1000).toLocaleString();
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toLocaleString();
    return s;
  }
  if (col === 'nbytes' || col.includes('byte')) {
    const n = Number(val);
    if (!isNaN(n)) return fmtBytes(n);
  }
  const n = Number(val);
  if (!isNaN(n) && s === String(n) && n > 999) return n.toLocaleString();
  return s;
}

// ── Palo Alto date helpers ─────────────────────────────────────────────────────

export function parsePADate(v) {
  if (!v) return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (m) {
    const [, dd, mm, yyyy, hh, min] = m;
    return new Date(+yyyy, +mm - 1, +dd, +hh, +min);
  }
  const n = Number(s);
  if (!isNaN(n)) return new Date(n > 9999999999 ? n : n * 1000);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function fmtDateTime(v) {
  const d = parsePADate(v);
  if (!d) return String(v ?? '');
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

export function isTimeCol(col) {
  return /time|date|timestamp/i.test(col);
}

export function isBytesCol(col) {
  return /byte|bps|bandwidth/i.test(col);
}

export function fmtLbl(v, colName) {
  const s = String(v ?? '');
  if (!s || s === 'undefined' || s === 'null') return '—';

  const num = Number(s.replace(/,/g, ''));
  if (!isNaN(num) && num > 1_000_000_000) {
    const ms = num > 9_999_999_999 ? num : num * 1000;
    return new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  }

  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (m) {
    const [, dd, mm, yyyy, hh, min] = m;
    return new Date(+yyyy, +mm - 1, +dd, +hh, +min).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  }

  if (colName && isTimeCol(colName)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  }

  return s.length > 20 ? s.slice(0, 20) + '…' : s;
}

// ── Risk trend builder ─────────────────────────────────────────────────────────

function parseBytesToBytes(v) {
  if (v == null || v === '') return 0;
  const s = String(v).replace(/,/g, '').trim().toLowerCase();
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  if (s.includes('tb')) return n * 1e12;
  if (s.includes('gb')) return n * 1e9;
  if (s.includes('mb')) return n * 1e6;
  if (s.includes('kb')) return n * 1e3;
  return n;
}

export function buildRiskTrendData(rows) {
  return rows.map((row, i) => {
    const rawTime = row['slabbed-receive_time'] || row['slabbed-receive-time'] || row['receive_time'] || row['receive-time'] || row['time'];
    const date = parsePADate(rawTime);
    const nbytesBytes = parseBytesToBytes(row['nbytes']);
    return {
      time: date ? date.getTime() : i,
      nbytesBytes,
      nbytesText: fmtBytes(nbytesBytes),
      nsessValue: getNum(row['nsess']),
      nsessText: String(row['nsess'] ?? ''),
    };
  }).sort((a, b) => Number(a.time) - Number(b.time));
}

// ── extractTable — parses raw Palo Alto API response ──────────────────────────

function toArr(v) {
  if (Array.isArray(v) && v.length > 0) return v;
  if (v && typeof v === 'object' && !Array.isArray(v)) return [v];
  return undefined;
}

export function extractTable(raw) {
  if (!raw) return null;
  try {
    const entry =
      toArr(raw?.report?.result?.entry) ??
      toArr(raw?.report?.result?.report?.entry) ??
      toArr(raw?.response?.result?.report?.entry) ??
      toArr(raw?.response?.result?.entry) ??
      toArr(raw?.result?.report?.entry) ??
      toArr(raw?.result?.entry) ??
      toArr(raw?.entry);

    if (entry && entry.length > 0) {
      const colSet = new Set();
      entry.forEach((e) => {
        if (typeof e === 'object' && e !== null) {
          Object.keys(e).forEach((k) => {
            if (k === '@name') colSet.add('name');
            else if (!k.startsWith('@')) colSet.add(k);
          });
        }
      });
      if (colSet.size === 0) return null;
      const columns = Array.from(colSet);
      const rows = entry.map((e) => {
        const row = {};
        columns.forEach((col) => {
          const rk = col === 'name' ? '@name' : col;
          const v = e?.[rk] ?? e?.[col];
          row[col] = typeof v === 'object' && v !== null && '#text' in v ? v['#text'] : (v ?? '');
        });
        return row;
      });
      return { columns, rows };
    }

    const result = raw?.report?.result ?? raw?.response?.result ?? raw?.result;
    if (result && typeof result === 'object') {
      const keys = Object.keys(result).filter((k) => !k.startsWith('@') && typeof result[k] !== 'object');
      if (keys.length > 0) return { columns: keys, rows: [Object.fromEntries(keys.map((k) => [k, result[k]]))] };
    }
  } catch {}
  return null;
}

// ── S1 data helpers ────────────────────────────────────────────────────────────

export function getPath(obj, path) {
  return path.split('.').reduce((acc, k) => (acc && typeof acc === 'object' ? acc[k] : undefined), obj);
}

function flattenKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) return flattenKeys(v, key);
    return [key];
  });
}

export function collectKeys(data) {
  const set = new Set();
  data.slice(0, 20).forEach((r) => {
    if (r && typeof r === 'object') flattenKeys(r).forEach((k) => set.add(k));
  });
  return Array.from(set).sort();
}

export function looksLikeDate(val) {
  if (typeof val !== 'string' || val.length < 6) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) return true;
  if (/^\w{3},?\s+\d{1,2}\s+\w{3}\s+\d{4}/.test(val)) return true;
  if (/^\d{4}\/\d{2}\/\d{2}/.test(val)) return true;
  if (!/^\d+$/.test(val.trim()) && !isNaN(Date.parse(val))) return true;
  return false;
}

export function toYMD(val) {
  if (!val) return '';
  const s = String(val);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const ms = Date.parse(s);
  if (!isNaN(ms)) return new Date(ms).toISOString().slice(0, 10);
  return '';
}

function extractDate(record) {
  const paths = ['synced_at', 'createdAt', 'created_at', 'date', 'publishedDate', 'detectionDate', 'detectedDate', 'markedDate', 'lastScanDate', 'threatInfo.createdAt', 'threatInfo.createdDate', 'createdDate', 'updatedAt', 'updated_at'];
  for (const p of paths) {
    const val = getPath(record, p);
    if (val) return String(val);
  }
  return '';
}

export function buildChartData(data, xKey, yKey, dateFrom, dateTo) {
  const filtered = data.filter((r) => {
    const dateStr = toYMD(extractDate(r));
    if (!dateStr) return true;
    return (!dateFrom || dateStr >= dateFrom) && (!dateTo || dateStr <= dateTo);
  });

  const buckets = {};
  filtered.forEach((r) => {
    const xVal = String(getPath(r, xKey) ?? '—');
    if (yKey === 'count') {
      buckets[xVal] = (buckets[xVal] ?? 0) + 1;
    } else {
      const yVal = String(getPath(r, yKey) ?? '—');
      const key = `${xVal} | ${yVal}`;
      buckets[key] = (buckets[key] ?? 0) + 1;
    }
  });

  return Object.entries(buckets)
    .map(([x, y]) => ({ x, y }))
    .sort((a, b) => b.y - a.y)
    .slice(0, 30);
}

export function labelFor(key) {
  const seg = key.split('.').pop() ?? key;
  return seg.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
