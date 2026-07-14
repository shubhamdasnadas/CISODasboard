import { useState, useEffect } from 'react';
import api from '../../api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

const STATUS_COLORS = {
  'Open': '#3b82f6',
  'Closed': '#22c55e',
  'On Hold': '#f59e0b',
  'Escalated': '#ef4444',
  'In Progress': '#8b5cf6',
  'Resolved': '#10b981',
  'Technically Closed': '#22c55e',
  'Duplicate': '#6b7280',
  'On Hold by Customer': '#f59e0b',
  'Acknowledge': '#1f2937',
  'WIP': '#1f2937',
  'Re-Open': '#6366f1',
  'Revert Awaited - Customer': '#f59e0b',
  'Revert Awaited - OEM': '#f59e0b',
  'Revert Awaited - Vendor': '#f59e0b',
};

const PRIORITY_COLORS = { High: '#ef4444', Critical: '#dc2626', Medium: '#f59e0b', Low: '#22c55e' };

function timeAgo(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ZohoPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [lastSynced, setLastSynced] = useState(null);

  const fetchTickets = () => {
    setLoading(true);
    setError('');
    api.get('/zoho/tickets-db')
      .then(r => {
        setTickets(r.data.tickets || []);
        setLastSynced(r.data.lastSyncedAt || null);
      })
      .catch(e => setError(e.response?.data?.message || e.response?.data?.error || 'Failed to load tickets'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTickets(); }, []);

  const handleSync = async () => {
    const accessToken = prompt('Enter Zoho access token to sync:');
    if (!accessToken) return;

    setSyncing(true);
    setError('');
    try {
      await api.post('/zoho/sync', { accessToken });
      fetchTickets();
    } catch (e) {
      setError(e.response?.data?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const statusCounts = Object.entries(
    tickets.reduce((acc, t) => {
      const s = t.status || 'Unknown';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const priorityCounts = Object.entries(
    tickets.reduce((acc, t) => {
      const p = t.priority || 'Unknown';
      acc[p] = (acc[p] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const departmentCounts = Object.entries(
    tickets.reduce((acc, t) => {
      const d = t.department || 'Unknown';
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);

  const filtered = tickets.filter(t =>
    !search ||
    (t.subject || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.contact_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.department || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-0.5">Support</p>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Zoho Desk</h1>
          {lastSynced && !loading && (
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Last synced {timeAgo(lastSynced)} &mdash; {tickets.length} tickets
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchTickets} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-[var(--card-border)] text-[var(--foreground)] hover:bg-[var(--muted-bg)] disabled:opacity-50 transition-colors">
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button onClick={handleSync} disabled={syncing || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition-colors">
            {syncing
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Syncing…</>
              : 'Sync from Zoho'
            }
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total',         value: tickets.length,                                              color: '#6366f1' },
          { label: 'Open',          value: tickets.filter(t => t.status === 'Open').length,             color: '#3b82f6' },
          { label: 'High Priority', value: tickets.filter(t => t.priority === 'High' || t.priority === 'Critical').length, color: '#ef4444' },
          { label: 'Closed',        value: tickets.filter(t => ['Closed', 'Technically Closed', 'Resolved'].includes(t.status)).length, color: '#22c55e' },
        ].map(s => (
          <div key={s.label} className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5">
            <p className="text-sm text-[var(--muted)] mb-1.5">{s.label}</p>
            <p className="text-3xl font-bold" style={{ color: s.color }}>{loading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6">
          <h3 className="font-semibold text-[var(--foreground)] mb-4">By Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}>
                {statusCounts.map(e => <Cell key={e.name} fill={STATUS_COLORS[e.name] || '#6366f1'} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8 }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6">
          <h3 className="font-semibold text-[var(--foreground)] mb-4">By Priority</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={priorityCounts}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--muted)' }} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--muted)' }} />
              <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {priorityCounts.map(e => <Cell key={e.name} fill={PRIORITY_COLORS[e.name] || '#6b7280'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6">
          <h3 className="font-semibold text-[var(--foreground)] mb-4">By Department</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={departmentCounts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
              <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8 }} />
              <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Search + Table */}
      <div>
        <input
          type="text" placeholder="Search by subject, contact, or department…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-[var(--foreground)] mb-4"
        />

        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-[var(--muted)]">
              {tickets.length === 0
                ? 'No tickets found. Click "Sync from Zoho" to fetch tickets.'
                : 'No tickets match your search.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--muted-bg)] text-left">
                    {['#', 'Subject', 'Status', 'Priority', 'Department', 'Contact', 'Assignee', 'Created'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-[var(--muted)] uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--card-border)]">
                  {filtered.slice(0, 100).map((t, i) => (
                    <tr key={t.id || i} className="hover:bg-[var(--muted-bg)] transition-colors">
                      <td className="px-4 py-3 text-xs text-[var(--muted)]">{t.ticketNumber || '—'}</td>
                      <td className="px-4 py-3 font-medium text-[var(--foreground)] max-w-xs truncate">{t.subject || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{
                          backgroundColor: `${STATUS_COLORS[t.status] || '#6b7280'}22`,
                          color: STATUS_COLORS[t.status] || '#6b7280',
                        }}>{t.status || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {t.priority && t.priority !== '—'
                          ? <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{
                              backgroundColor: `${PRIORITY_COLORS[t.priority] || '#6b7280'}22`,
                              color: PRIORITY_COLORS[t.priority] || '#6b7280',
                            }}>{t.priority}</span>
                          : <span className="text-[var(--muted)]">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)] text-xs max-w-[120px] truncate">{t.department || '—'}</td>
                      <td className="px-4 py-3 text-[var(--muted)] max-w-[120px] truncate">{t.contact_name || '—'}</td>
                      <td className="px-4 py-3 text-[var(--muted)] max-w-[120px] truncate">{t.assignee || '—'}</td>
                      <td className="px-4 py-3 text-[var(--muted)] text-xs whitespace-nowrap">{t.created_time ? timeAgo(t.created_time) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 100 && (
                <p className="px-4 py-3 text-xs text-center text-[var(--muted)] border-t border-[var(--card-border)]">
                  Showing 100 of {filtered.length} tickets
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
