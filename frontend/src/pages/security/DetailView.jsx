import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import api from '../../api.js';

const PAGE_SIZE = 25;
const RECENT_CAP = 1500;
const CAPPED_FILTERS = new Set(['classification', 'severity']);

const fmt = (d) => d ? new Date(d).toLocaleString() : '—';
const yesNo = (v) => v ? 'Yes' : 'No';

function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

const MITRE_FILTERS = new Set(['mitreTechnique', 'mitreTactic']);

function extractTechId(link) {
  const m = /\/techniques\/(T\d+)(?:\/(\d+))?\/?$/.exec(link || '');
  return m ? (m[2] ? `${m[1]}.${m[2]}` : m[1]) : null;
}

const DATASET_CONFIG = {
  threats: {
    endpoint: '/sentinelone/db/threats',
    extract: (r) => r.data?.data || r.data?.threats || [],
    dateField: (t) => t.threatInfo?.createdAt,
    // Red/top-sorted only for genuinely outstanding threats — excludes benign-marked ones,
    // which otherwise have a non-'mitigated' status but aren't actually a problem.
    isBad: (t) => t.threatInfo?.incidentStatus === 'unresolved'
      && t.threatInfo?.mitigationStatus !== 'mitigated'
      && t.threatInfo?.mitigationStatus !== 'marked_as_benign',
    cols: ['Endpoint', 'Site', 'Group', 'User', 'Classification', 'Incident Status', 'Mitigation', 'Fileless', 'Confidence', 'Created At', 'Identified At'],
    rowFn: (t) => [
      t.agentRealtimeInfo?.agentComputerName,
      t.agentRealtimeInfo?.siteName,
      t.agentRealtimeInfo?.groupName,
      t.threatInfo?.processUser,
      t.threatInfo?.classification,
      t.threatInfo?.incidentStatus,
      t.threatInfo?.mitigationStatus,
      yesNo(t.threatInfo?.isFileless),
      t.threatInfo?.confidenceLevel,
      fmt(t.threatInfo?.createdAt),
      fmt(t.threatInfo?.identifiedAt),
    ],
  },
  cve: {
    endpoint: '/sentinelone/db/application-cve',
    extract: (r) => r.data?.data || r.data?.cves || [],
    dateField: (r) => r.detectionDate,
    cols: ['CVE ID', 'Application', 'Vendor', 'Severity', 'Base Score', 'Days Detected', 'Endpoint', 'Detection Date', 'Status'],
    rowFn: (r) => [
      r.cveId,
      r.applicationName || r.application,
      r.applicationVendor,
      r.severity,
      r.baseScore,
      r.daysDetected,
      r.endpointName,
      fmt(r.detectionDate),
      r.status,
    ],
  },
  agents: {
    endpoint: '/sentinelone/db/agents',
    extract: (r) => r.data?.agents || r.data?.data || [],
    dateField: (a) => a.lastActiveDate,
    cols: ['Machine', 'User', 'Site', 'OS', 'Active', 'Active Threats', 'Mitigation Mode', 'Up To Date', 'Firewall', 'Last Active', 'Agent Version'],
    rowFn: (a) => [
      a.computerName,
      a.lastLoggedInUserName,
      a.siteName,
      a.osName,
      yesNo(a.isActive),
      a.activeThreats,
      a.mitigationMode,
      yesNo(a.isUpToDate),
      yesNo(a.firewallEnabled),
      fmt(a.lastActiveDate),
      a.agentVersion,
    ],
  },
};

const FILTERS = {
  unresolved:      (t) => ['unresolved', 'active'].includes(t.threatInfo?.incidentStatus),
  topEndpoint:      (t, value) => t.agentRealtimeInfo?.agentComputerName === value,
  classification:   (t, value) => (t.threatInfo?.classification || 'Unknown') === value,
  severity:         (r, value) => (r.severity || 'UNKNOWN').toUpperCase() === value,
  topRiskyApp:      (r, value) => (r.applicationName || r.application || 'Unknown') === value,
  mitreTechnique:   (t, value) => (t.indicators || []).some((ind) =>
    (ind.tactics || []).some((tac) => (tac.techniques || []).some((tech) => tech.name === value))),
  mitreTactic:      (t, value) => (t.indicators || []).some((ind) =>
    (ind.tactics || []).some((tac) => (tac.name || '').toLowerCase() === value.toLowerCase())),
  activeThreats:    (a) => (a.activeThreats || 0) > 0,
  agentDetail:      (a, value) => a.computerName === value,
};

export default function DetailView() {
  const location = useLocation();
  const navigate = useNavigate();
  const { dataset, filterId, value, title, dateFrom: incomingDateFrom, dateTo: incomingDateTo } = location.state || {};

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(incomingDateFrom || '');
  const [dateTo, setDateTo] = useState(incomingDateTo || '');
  const [page, setPage] = useState(1);
  const [mitreDescriptions, setMitreDescriptions] = useState(null);

  const config = dataset ? DATASET_CONFIG[dataset] : null;
  const filterFn = filterId ? FILTERS[filterId] : null;

  useEffect(() => {
    if (!config) { setLoading(false); return; }
    setLoading(true);
    api.get(config.endpoint)
      .then((r) => setRows(config.extract(r)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dataset]);

  useEffect(() => {
    if (!MITRE_FILTERS.has(filterId)) return;
    api.get('/mitre/techniques')
      .then((r) => setMitreDescriptions(r.data?.techniques || {}))
      .catch(() => setMitreDescriptions({}));
  }, [filterId]);

  useEffect(() => { setPage(1); }, [dateFrom, dateTo, filterId, value]);

  const dateValue = (r) => {
    const d = config?.dateField ? parseDate(config.dateField(r)) : null;
    return d ? d.getTime() : 0;
  };

  const hasDateFilter = !!(dateFrom || dateTo);

  const { processedRows, capped, totalCount } = useMemo(() => {
    if (!config || !filterFn) return { processedRows: [], capped: false, totalCount: 0 };

    let result = rows.filter((r) => filterFn(r, value));

    if (hasDateFilter) {
      result = result.filter((r) => {
        const d = config.dateField ? parseDate(config.dateField(r)) : null;
        if (!d) return false;
        const key = d.toISOString().slice(0, 10);
        if (dateFrom && key < dateFrom) return false;
        if (dateTo   && key > dateTo)   return false;
        return true;
      });
    }

    let didCap = false;
    const totalCount = result.length;
    if (!hasDateFilter && CAPPED_FILTERS.has(filterId) && result.length > RECENT_CAP) {
      result = [...result].sort((a, b) => dateValue(b) - dateValue(a)).slice(0, RECENT_CAP);
      didCap = true;
    }

    if (config.isBad) {
      result = [...result].sort((a, b) => {
        const ab = config.isBad(a) ? 0 : 1;
        const bb = config.isBad(b) ? 0 : 1;
        if (ab !== bb) return ab - bb;
        return dateValue(b) - dateValue(a);
      });
    }

    return { processedRows: result, capped: didCap, totalCount };
  }, [rows, filterFn, value, dateFrom, dateTo, hasDateFilter, filterId, config]);

  // Distinct techniques actually present in the filtered rows, for the
  // description panel — for a single-technique filter this is just that one
  // technique; for a tactic filter it's every technique under it that shows
  // up in the current results.
  const relevantTechniques = useMemo(() => {
    if (!MITRE_FILTERS.has(filterId)) return [];
    const seen = new Map();
    processedRows.forEach((t) => {
      (t.indicators || []).forEach((ind) => {
        (ind.tactics || []).forEach((tac) => {
          if (filterId === 'mitreTactic' && (tac.name || '').toLowerCase() !== value.toLowerCase()) return;
          (tac.techniques || []).forEach((tech) => {
            if (filterId === 'mitreTechnique' && tech.name !== value) return;
            const id = extractTechId(tech.link);
            const key = id || tech.name;
            if (!seen.has(key)) seen.set(key, { id, name: tech.name, link: tech.link });
          });
        });
      });
    });
    return [...seen.values()];
  }, [processedRows, filterId, value]);

  const totalPages = Math.max(1, Math.ceil(processedRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return processedRows.slice(start, start + PAGE_SIZE);
  }, [processedRows, currentPage]);

  if (!config || !filterFn) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[300px] text-center">
        <p className="text-base font-semibold text-[var(--foreground)]">No detail to show</p>
        <p className="text-sm text-[var(--muted)] mt-1">Navigate here by clicking a KPI card or chart segment.</p>
        <Link to="/security" className="mt-4 text-sm text-indigo-500 hover:text-indigo-700 font-semibold">Back to Security</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold mb-1"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold text-[var(--foreground)]">{title || 'Details'}</h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">
            {totalCount} record{totalCount === 1 ? '' : 's'}
            {capped && ` · showing ${RECENT_CAP} most recent — apply a date filter to see more`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-[var(--muted)] font-medium">From</label>
            <input type="date" value={dateFrom} max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-[10px] px-2 py-1 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-[var(--muted)] font-medium">To</label>
            <input type="date" value={dateTo} min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-[10px] px-2 py-1 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          {hasDateFilter && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-[10px] text-indigo-500 hover:text-indigo-700 font-semibold">Clear</button>
          )}
        </div>
      </div>

      {relevantTechniques.length > 0 && (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4 space-y-3">
          {relevantTechniques.map((tech) => {
            const desc = tech.id && mitreDescriptions ? mitreDescriptions[tech.id] : null;
            return (
              <div key={tech.id || tech.name}>
                <p className="text-xs font-semibold text-[var(--foreground)]">
                  {tech.id && <span className="font-mono text-[var(--muted)] mr-1.5">{tech.id}</span>}
                  {tech.name}
                </p>
                {mitreDescriptions === null ? (
                  <p className="text-xs text-[var(--muted)] mt-0.5">Loading description…</p>
                ) : desc?.description ? (
                  <p className="text-xs text-[var(--muted)] mt-0.5">{desc.description}</p>
                ) : (
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    No description available.{' '}
                    {tech.link && <a href={tech.link} target="_blank" rel="noreferrer" className="text-indigo-500 hover:text-indigo-700 font-medium">View on MITRE ATT&CK ↗</a>}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden shadow-sm">
        {processedRows.length === 0
          ? <div className="px-4 py-8 text-center text-sm text-[var(--muted)]">No matching records</div>
          : (
            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[var(--muted-bg)]">
                    {config.cols.map((c) => (
                      <th key={c} className="px-3 py-2 text-left font-semibold text-[var(--muted)] uppercase tracking-wide whitespace-nowrap border-b border-[var(--card-border)]">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--card-border)]">
                  {pageRows.map((row, i) => {
                    const bad = config.isBad && config.isBad(row);
                    return (
                      <tr key={i} className={bad ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50' : 'hover:bg-[var(--muted-bg)]/60'}>
                        {config.rowFn(row).map((cell, j) => (
                          <td key={j} className={`px-3 py-2 whitespace-nowrap max-w-[220px] truncate ${bad ? '' : 'text-[var(--foreground)]'}`}>{cell ?? '—'}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        }
      </div>

      {processedRows.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-[var(--muted)]">
            Page {currentPage} of {totalPages} · {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, processedRows.length)} of {processedRows.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--card-border)] text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--muted-bg)]"
            >
              Previous
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--card-border)] text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--muted-bg)]"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
