import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../../api';
import TicketVolcanoGraph from './TicketVolcanoGraph';
import Circlemember from './Circlemember';
import Mttrcard from './Mttrcard';
import Funneldiagram from './Funneldiagram';
import Hourbasedset from './Hourbasedset';
import Zohoticketcount from './Zohoticketcount';
import Topperformance from './Topperformance';

const weekdays   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const agingBuckets = ['<1h', '1-4h', '4-24h', '1-3d', '3+d'];
const barColors  = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777'];
const closedStatuses = new Set(['closed', 'technically closed', 'duplicate']);
const pageSize   = 10;

const normalizeText   = (v) => String(v || '').trim();
const getTicketNo     = (t) => normalizeText(t.ticket_no) || normalizeText(t.ticketNumber) || '-';
const getCreatedAt    = (t) => normalizeText(t.created_at) || normalizeText(t.createdTime);
const getClosedAt     = (t) => normalizeText(t.closed_at) || normalizeText(t.closedTime) || normalizeText(t.closedAt) || normalizeText(t.closeTime) || normalizeText(t.closedDate);
const getCustomerResponseTime = (t) => normalizeText(t.customerResponseTime) || normalizeText(t.customer_response_time) || normalizeText(t.customer_responseTime) || normalizeText(t.responseTime) || '-';
const getAssigneeName = (t) => `${normalizeText(t.assignee?.firstName)} ${normalizeText(t.assignee?.lastName)}`.trim() || 'Unassigned';
const getDeptName     = (t) => normalizeText(t.department?.name) || normalizeText(t.departmentName) || 'Unknown Department';
const isClosedTicket  = (t) => closedStatuses.has(normalizeText(t.status).toLowerCase());
const getTicketKey    = (t, i) => normalizeText(t.id) || normalizeText(t.ticketNumber) || normalizeText(t.ticket_no) || String(i);

const formatDateTime = (date) => {
  if (!date) return '-';
  const p = new Date(date);
  if (isNaN(p.getTime())) return '-';
  return p.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatResolutionTime = (t) => {
  const ca = getCreatedAt(t), cl = getClosedAt(t);
  const cd = new Date(ca), cld = new Date(cl);
  if (!ca || !cl || isNaN(cd.getTime()) || isNaN(cld.getTime()) || cld < cd) return '-';
  const mins = Math.round((cld - cd) / 60000);
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const getResolutionTimeBucket = (t) => {
  if (!isClosedTicket(t)) return null;
  const ca = getCreatedAt(t), cl = getClosedAt(t);
  const cd = new Date(ca), cld = new Date(cl);
  if (!ca || !cl || isNaN(cd.getTime()) || isNaN(cld.getTime()) || cld < cd) return null;
  const h = (cld - cd) / (1000 * 60 * 60);
  if (h < 1) return '<1h'; if (h < 4) return '1-4h'; if (h < 24) return '4-24h'; if (h < 72) return '1-3d'; return '3+d';
};

// ── TicketTracking ─────────────────────────────────────────────────────────────
function TicketTracking({ ticket }) {
  const createdTime = formatDateTime(getCreatedAt(ticket));
  const customerResponseTime = getCustomerResponseTime(ticket);
  const closedTime = formatDateTime(getClosedAt(ticket));
  const hasCreated = createdTime !== '-', hasResponse = customerResponseTime !== '-', hasClosed = closedTime !== '-';
  const progress = hasClosed ? 100 : hasResponse ? 50 : hasCreated ? 8 : 0;
  const steps = [
    { label: 'Created Time', value: createdTime, complete: hasCreated },
    { label: 'Customer Response Time', value: customerResponseTime, complete: hasResponse },
    { label: 'Closed Time', value: closedTime, complete: hasClosed },
  ];
  return (
    <div className="rounded-md bg-[var(--card-bg)] px-4 py-5">
      <div className="relative mx-1 pb-2">
        <div className="absolute left-0 right-0 top-4 h-2 rounded-full bg-slate-200" />
        <div className="absolute left-0 top-4 h-2 rounded-full bg-indigo-600 transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
        <div className="relative grid grid-cols-3 gap-3">
          {steps.map((step, idx) => (
            <div key={step.label} className={`flex ${idx === 0 ? 'items-start' : idx === 1 ? 'items-center' : 'items-end'} flex-col`}>
              <span className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-500 ${step.complete ? 'border-indigo-600 bg-indigo-600 text-white shadow-[0_0_0_6px_rgba(79,70,229,0.12)]' : 'border-indigo-500 bg-[var(--card-bg)] text-indigo-600'}`}>
                {step.complete ? <span className="text-sm leading-none">✓</span> : <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-indigo-500" />}
              </span>
              <div className={`mt-4 max-w-[180px] text-sm ${idx === 0 ? 'text-left' : idx === 1 ? 'text-center' : 'text-right'}`}>
                <div className="text-xs font-bold uppercase text-[var(--muted)]">{step.label}</div>
                <div className="mt-1 font-medium text-[var(--foreground)]">{step.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── HoverCount ─────────────────────────────────────────────────────────────────
function HoverCount({ title, count, tickets }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef(null);
  const clearTimer = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } };
  const show = () => { clearTimer(); setOpen(true); };
  const hide = () => { clearTimer(); closeTimer.current = setTimeout(() => setOpen(false), 180); };
  useEffect(() => () => clearTimer(), []);

  return (
    <span className="relative inline-flex min-w-10 justify-end" onMouseEnter={show} onMouseLeave={hide}>
      <span className={count ? 'cursor-pointer font-semibold text-indigo-600' : 'text-[var(--muted)]'}>{count}</span>
      {open && count > 0 && (
        <div onMouseEnter={clearTimer} onMouseLeave={hide}
          className="fixed left-1/2 top-24 z-50 w-[min(92vw,780px)] -translate-x-1/2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3 text-[var(--foreground)] shadow-xl">
          <p className="mb-2 text-sm font-semibold">{title}</p>
          <div className="max-h-72 overflow-auto">
            <table className="w-full min-w-[900px] border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--muted-bg)]">
                  {['ticket_no', 'subject', 'createdTime', 'closedTime', 'resolve_time', 'assignee', 'status'].map(h => (
                    <th key={h} className="border border-[var(--card-border)] px-2 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickets.map((t, i) => (
                  <tr key={`${getTicketNo(t)}-${t.id || i}`}>
                    <td className="border border-[var(--card-border)] px-2 py-2">{getTicketNo(t)}</td>
                    <td className="border border-[var(--card-border)] px-2 py-2">{t.subject || '-'}</td>
                    <td className="border border-[var(--card-border)] px-2 py-2">{formatDateTime(getCreatedAt(t))}</td>
                    <td className="border border-[var(--card-border)] px-2 py-2">{formatDateTime(getClosedAt(t))}</td>
                    <td className="border border-[var(--card-border)] px-2 py-2">{formatResolutionTime(t)}</td>
                    <td className="border border-[var(--card-border)] px-2 py-2">{getAssigneeName(t)}</td>
                    <td className="border border-[var(--card-border)] px-2 py-2">{t.status || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </span>
  );
}

// ── TicketListCard ─────────────────────────────────────────────────────────────
function TicketListCard({ tickets, loading }) {
  const [assignee, setAssignee] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]     = useState('');
  const [page, setPage]         = useState(1);
  const [expanded, setExpanded] = useState({});

  const assignees = useMemo(() =>
    Array.from(new Set(tickets.map(getAssigneeName))).filter(Boolean).sort((a, b) => a.localeCompare(b)), [tickets]);

  const filtered = useMemo(() => {
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to   = toDate   ? new Date(`${toDate}T23:59:59`)   : null;
    return tickets.filter(t => {
      if (assignee !== 'all' && getAssigneeName(t) !== assignee) return false;
      const ca = getCreatedAt(t); const cd = new Date(ca);
      if ((from || to) && (!ca || isNaN(cd.getTime()))) return false;
      if (from && cd < from) return false;
      if (to && cd > to) return false;
      return true;
    });
  }, [assignee, fromDate, toDate, tickets]);

  const pageCount   = Math.max(Math.ceil(filtered.length / pageSize), 1);
  const safePage    = Math.min(page, pageCount);
  const startIndex  = filtered.length ? (safePage - 1) * pageSize : 0;
  const endIndex    = Math.min(startIndex + pageSize, filtered.length);
  const visible     = filtered.slice(startIndex, endIndex);
  const pages       = Array.from({ length: pageCount }, (_, i) => i + 1).filter(p => p === 1 || p === pageCount || Math.abs(p - safePage) <= 1);
  const goTo        = (p) => setPage(Math.min(Math.max(p, 1), pageCount));
  const reset       = () => { setPage(1); setExpanded({}); };

  return (
    <section className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <h2 className="text-xl font-bold text-[var(--foreground)]">Ticket Details</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[620px]">
          {[
            { label: 'Assignee', type: 'select', value: assignee, onChange: v => { setAssignee(v); reset(); } },
          ].map(() => null)}
          <label className="text-sm font-medium text-[var(--foreground)]">
            <span className="mb-1 block">Assignee</span>
            <select value={assignee} onChange={e => { setAssignee(e.target.value); reset(); }}
              className="h-10 w-full rounded-md border border-[var(--card-border)] bg-[var(--muted-bg)] px-3 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="all">All assignees</option>
              {assignees.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-[var(--foreground)]">
            <span className="mb-1 block">From</span>
            <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); reset(); }}
              className="h-10 w-full rounded-md border border-[var(--card-border)] bg-[var(--muted-bg)] px-3 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>
          <label className="text-sm font-medium text-[var(--foreground)]">
            <span className="mb-1 block">To</span>
            <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); reset(); }}
              className="h-10 w-full rounded-md border border-[var(--card-border)] bg-[var(--muted-bg)] px-3 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--card-border)] bg-[var(--muted-bg)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--card-bg)]">
                <th className="w-12 px-4 py-3 text-left font-semibold text-[var(--foreground)]" />
                <th className="px-4 py-3 text-left font-semibold text-[var(--foreground)]">Subject</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((ticket, i) => {
                const key = getTicketKey(ticket, startIndex + i);
                const isExpanded = Boolean(expanded[key]);
                return (
                  <>
                    <tr key={key} className="border-t border-[var(--card-border)]">
                      <td className="px-4 py-3 align-top">
                        <button type="button" onClick={() => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))}
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] text-sm font-bold text-[var(--foreground)] transition-colors hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                          {isExpanded ? '^' : 'v'}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--foreground)]">{ticket.subject || '-'}</td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${key}-exp`} className="border-t border-[var(--card-border)] bg-[var(--card-bg)]">
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3"><TicketTracking ticket={ticket} /></td>
                      </tr>
                    )}
                  </>
                );
              })}
              {!visible.length && (
                <tr><td colSpan={2} className="px-4 py-8 text-center text-[var(--muted)]">{loading ? 'Loading...' : 'No tickets found'}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <div>Showing {filtered.length ? startIndex + 1 : 0} to {endIndex} of {filtered.length} entries</div>
          <div className="flex flex-wrap items-center gap-2">
            {[['First', 1], ['Prev', safePage - 1]].map(([label, target]) => (
              <button key={label} type="button" onClick={() => goTo(target)} disabled={safePage === 1}
                className="rounded-md border border-[var(--card-border)] px-3 py-1.5 font-medium text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50">
                {label}
              </button>
            ))}
            {pages.map((p, idx) => {
              const prev = pages[idx - 1];
              return (
                <>
                  {prev && p - prev > 1 && <span key={`gap-${p}`} className="px-1">...</span>}
                  <button key={p} type="button" onClick={() => goTo(p)}
                    className={`h-9 min-w-9 rounded-md border border-[var(--card-border)] px-3 font-semibold ${safePage === p ? 'bg-indigo-600 text-white' : 'text-[var(--foreground)]'}`}>
                    {p}
                  </button>
                </>
              );
            })}
            {[['Next', safePage + 1], ['Last', pageCount]].map(([label, target]) => (
              <button key={label} type="button" onClick={() => goTo(target)} disabled={safePage === pageCount}
                className="rounded-md border border-[var(--card-border)] px-3 py-1.5 font-medium text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50">
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Zohoone() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeDay, setActiveDay] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get('/zoho/tickets-db')
      .then(r => setTickets(r.data.responseData || []))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  }, []);

  const ticketTrend = useMemo(() => {
    const grouped = weekdays.map(day => ({ day, tickets: [] }));
    tickets.forEach(t => {
      const ca = getCreatedAt(t); const d = new Date(ca);
      if (!ca || isNaN(d.getTime())) return;
      const idx = (d.getDay() + 6) % 7;
      grouped[idx].tickets.push(t);
    });
    return grouped;
  }, [tickets]);

  const engineerPerformance = useMemo(() => {
    const grouped = {};
    tickets.forEach(t => {
      const eng = getAssigneeName(t);
      if (eng === 'Unassigned') return;
      if (!grouped[eng]) grouped[eng] = { engineer: eng, open: [], closed: [] };
      isClosedTicket(t) ? grouped[eng].closed.push(t) : grouped[eng].open.push(t);
    });
    return Object.values(grouped).sort((a, b) => (b.closed.length - a.closed.length) || a.engineer.localeCompare(b.engineer));
  }, [tickets]);

  const activeTrend   = ticketTrend.find(r => r.day === activeDay);
  const maxTicketCount = Math.max(...ticketTrend.map(r => r.tickets.length), 1);

  const departmentAgingMatrix = useMemo(() => {
    const grouped = {};
    tickets.forEach(t => {
      const dept   = getDeptName(t);
      const bucket = getResolutionTimeBucket(t);
      if (!bucket) return;
      if (!grouped[dept]) { grouped[dept] = {}; agingBuckets.forEach(b => { grouped[dept][b] = []; }); }
      grouped[dept][bucket].push(t);
    });
    return Object.entries(grouped).map(([dept, buckets]) => ({ department: dept, buckets }))
      .sort((a, b) => {
        const aT = agingBuckets.reduce((s, b) => s + a.buckets[b].length, 0);
        const bT = agingBuckets.reduce((s, b) => s + b.buckets[b].length, 0);
        return bT - aT || a.department.localeCompare(b.department);
      });
  }, [tickets]);

  const monthDepartmentMatrix = useMemo(() => {
    const monthMap = new Map(); const deptMap = {};
    tickets.forEach(t => {
      const ca = getCreatedAt(t); const d = new Date(ca);
      if (!ca || isNaN(d.getTime())) return;
      const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-US', { month: 'short' });
      const dept  = getDeptName(t);
      monthMap.set(key, label);
      if (!deptMap[dept]) deptMap[dept] = {};
      if (!deptMap[dept][key]) deptMap[dept][key] = [];
      deptMap[dept][key].push(t);
    });
    const months = Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-5).map(([key, label]) => ({ key, label }));
    const rows   = Object.entries(deptMap).map(([dept, mt]) => ({ department: dept, monthTickets: mt }))
      .sort((a, b) => {
        const aT = months.reduce((s, m) => s + (a.monthTickets[m.key]?.length || 0), 0);
        const bT = months.reduce((s, m) => s + (b.monthTickets[m.key]?.length || 0), 0);
        return bT - aT || a.department.localeCompare(b.department);
      });
    return { months, rows };
  }, [tickets]);

  const maxAgingCount = Math.max(...departmentAgingMatrix.flatMap(r => agingBuckets.map(b => r.buckets[b].length)), 1);
  const maxMonthCount = Math.max(...monthDepartmentMatrix.rows.flatMap(r => monthDepartmentMatrix.months.map(m => r.monthTickets[m.key]?.length || 0)), 1);
  const monthGridStyle = { '--month-grid': `minmax(150px, 1.4fr) repeat(${Math.max(monthDepartmentMatrix.months.length, 1)}, minmax(72px, 1fr))` };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Zoho One</h1>
          <p className="text-sm text-[var(--muted)]">Ticket analytics from stored Zoho data.</p>
        </div>
        <div className="text-sm text-[var(--muted)]">{loading ? 'Loading tickets...' : `${tickets.length} tickets`}</div>
      </div>

      <TicketListCard tickets={tickets} loading={loading} />
      <TicketVolcanoGraph tickets={tickets} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <Circlemember tickets={tickets} />
        <Mttrcard tickets={tickets} />
        <Topperformance tickets={tickets} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Funneldiagram />
      </div>
      <div className="grid gap-5">
        <Hourbasedset tickets={tickets} />
      </div>
      <div className="grid gap-5">
        <Zohoticketcount />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Ticket Trend */}
        <section className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm">
          <div className="mb-5"><h2 className="text-xl font-bold text-[var(--foreground)]">Ticket Trend</h2></div>
          <div className="rounded-lg border border-[var(--card-border)] bg-[var(--muted-bg)] p-4 sm:p-6">
            {activeTrend && activeTrend.tickets.length > 0 && (
              <div className="mb-5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3 text-[var(--foreground)] shadow-sm">
                <p className="mb-2 text-sm font-semibold">{activeTrend.day} tickets ({activeTrend.tickets.length})</p>
                <div className="max-h-72 overflow-auto">
                  <table className="w-full min-w-[900px] border-collapse text-xs">
                    <thead><tr className="bg-[var(--muted-bg)]">
                      {['ticket_no','subject','createdTime','closedTime','resolve_time','assignee','status'].map(h => (
                        <th key={h} className="border border-[var(--card-border)] px-2 py-2 text-left">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>{activeTrend.tickets.map((t, i) => (
                      <tr key={i}>
                        <td className="border border-[var(--card-border)] px-2 py-2">{getTicketNo(t)}</td>
                        <td className="border border-[var(--card-border)] px-2 py-2">{t.subject || '-'}</td>
                        <td className="border border-[var(--card-border)] px-2 py-2">{formatDateTime(getCreatedAt(t))}</td>
                        <td className="border border-[var(--card-border)] px-2 py-2">{formatDateTime(getClosedAt(t))}</td>
                        <td className="border border-[var(--card-border)] px-2 py-2">{formatResolutionTime(t)}</td>
                        <td className="border border-[var(--card-border)] px-2 py-2">{getAssigneeName(t)}</td>
                        <td className="border border-[var(--card-border)] px-2 py-2">{t.status || '-'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="h-full w-full flex h-32 items-end gap-3 overflow-x-auto pb-2 sm:gap-5">
              {ticketTrend.map((row, idx) => {
                const count  = row.tickets.length;
                const height = Math.max((count / maxTicketCount) * 100, count ? 10 : 3);
                const isSel  = activeDay === row.day;
                return (
                  <div key={row.day} className="h-full w-full flex min-w-16 flex-1 flex-col items-center justify-end gap-2">
                    <button type="button" onClick={() => setActiveDay(prev => prev === row.day ? null : row.day)}
                      className={`rounded px-1.5 py-0.5 text-sm font-bold transition-colors ${isSel ? 'bg-indigo-600 text-white' : count ? 'text-[var(--foreground)] hover:bg-[var(--card-bg)]' : 'text-[var(--foreground)]'}`}>
                      {count}
                    </button>
                    <button type="button" aria-label={`${row.day}: ${count} tickets`}
                      className="w-full min-w-12 rounded-t-md transition-all hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      style={{ height: `${height}%`, backgroundColor: barColors[idx] }}
                      onClick={() => setActiveDay(prev => prev === row.day ? null : row.day)} />
                    <div className="text-xs font-semibold text-[var(--muted)]">{row.day}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Engineer Performance */}
        <section className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm">
          <div className="mb-5"><h2 className="text-xl font-bold text-[var(--foreground)]">Engineer Performance</h2></div>
          <div className="overflow-x-auto rounded-lg border border-[var(--card-border)] bg-[var(--muted-bg)] p-4">
            <table className="w-full min-w-[360px] text-sm">
              <thead><tr>
                <th className="pb-3 text-left font-semibold text-[var(--foreground)]">Engineer</th>
                <th className="pb-3 text-right font-semibold text-[var(--foreground)]">Open</th>
                <th className="pb-3 text-right font-semibold text-[var(--foreground)]">Closed</th>
              </tr></thead>
              <tbody>
                {engineerPerformance.map(row => (
                  <tr key={row.engineer}>
                    <td className="py-1.5 pr-6 font-medium text-[var(--foreground)]">{row.engineer}</td>
                    <td className="py-1.5 text-right"><HoverCount title={`${row.engineer} open tickets`} count={row.open.length} tickets={row.open} /></td>
                    <td className="py-1.5 text-right"><HoverCount title={`${row.engineer} closed tickets`} count={row.closed.length} tickets={row.closed} /></td>
                  </tr>
                ))}
                {!engineerPerformance.length && <tr><td colSpan={3} className="py-6 text-center text-[var(--muted)]">{loading ? 'Loading...' : 'No tickets found'}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {/* Resolution Time Heatmap */}
        <section className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-2 shadow-sm">
          <div className="mb-5"><h2 className="text-xl font-bold text-[var(--foreground)]">Department Based Resolution Time Heatmap</h2></div>
          <div className="rounded-lg border border-[var(--card-border)] bg-[var(--muted-bg)] p-2">
            {departmentAgingMatrix.length ? (
              <div className="space-y-4">
                <div className="hidden grid-cols-[minmax(120px,1.4fr)_repeat(5,minmax(72px,1fr))] gap-1 text-xs font-semibold text-[var(--muted)] md:grid">
                  <div>Department</div>
                  {agingBuckets.map(b => <div key={b} className="text-center">{b}</div>)}
                </div>
                {departmentAgingMatrix.map(row => (
                  <div key={row.department} className="grid gap-1 md:grid-cols-[minmax(120px,1.4fr)_repeat(5,minmax(72px,1fr))]">
                    <div className="flex items-center rounded-md bg-[var(--card-bg)] px-2 py-2 text-sm font-semibold text-[var(--foreground)]">{row.department}</div>
                    {agingBuckets.map(b => {
                      const bt = row.buckets[b]; const cnt = bt.length;
                      const intensity = cnt / maxAgingCount;
                      return (
                        <div key={b} className="rounded-md border border-[var(--card-border)] px-3 py-2" style={{ backgroundColor: cnt ? `rgba(79, 70, 229, ${0.12 + intensity * 0.45})` : 'var(--card-bg)' }}>
                          <div className="mb-1 flex items-center justify-between gap-2 md:hidden"><span className="text-xs font-semibold text-[var(--muted)]">{b}</span></div>
                          <div className="flex items-center justify-between gap-2 md:justify-center">
                            <span className="h-2 w-2 rounded-full bg-indigo-500" />
                            <HoverCount title={`${row.department} ${b} tickets`} count={cnt} tickets={bt} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-[var(--muted)]">{loading ? 'Loading...' : 'No tickets found'}</div>
            )}
          </div>
        </section>

        {/* Monthly Volume */}
        <section className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm">
          <div className="mb-5"><h2 className="text-xl font-bold text-[var(--foreground)]">Department Based Monthly Ticket Volume</h2></div>
          <div className="rounded-lg border border-[var(--card-border)] bg-[var(--muted-bg)] p-4">
            {monthDepartmentMatrix.rows.length ? (
              <div className="space-y-4">
                <div className="hidden gap-2 text-xs font-semibold text-[var(--muted)] md:grid" style={{ gridTemplateColumns: 'var(--month-grid)', ...monthGridStyle }}>
                  <div>Department</div>
                  {monthDepartmentMatrix.months.map(m => <div key={m.key} className="text-center">{m.label}</div>)}
                </div>
                {monthDepartmentMatrix.rows.map(row => (
                  <div key={row.department} className="grid gap-2" style={{ gridTemplateColumns: 'var(--month-grid)', ...monthGridStyle }}>
                    <div className="flex items-center rounded-md bg-[var(--card-bg)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]">{row.department}</div>
                    {monthDepartmentMatrix.months.map(m => {
                      const mt = row.monthTickets[m.key] || []; const cnt = mt.length;
                      const intensity = cnt / maxMonthCount;
                      return (
                        <div key={m.key} className="rounded-md border border-[var(--card-border)] px-3 py-2" style={{ backgroundColor: cnt ? `rgba(8, 145, 178, ${0.12 + intensity * 0.45})` : 'var(--card-bg)' }}>
                          <div className="mb-1 flex items-center justify-between gap-2 md:hidden"><span className="text-xs font-semibold text-[var(--muted)]">{m.label}</span></div>
                          <div className="flex items-center justify-between gap-2 md:justify-center">
                            <span className="h-2 w-2 rounded-full bg-cyan-600" />
                            <HoverCount title={`${row.department} ${m.label} tickets`} count={cnt} tickets={mt} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-[var(--muted)]">{loading ? 'Loading...' : 'No tickets found'}</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
