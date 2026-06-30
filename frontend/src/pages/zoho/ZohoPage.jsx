import { useState, useEffect } from 'react';
import api from '../../api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

const STATUS_COLORS = { Open: '#3b82f6', Closed: '#22c55e', 'On Hold': '#f59e0b', Escalated: '#ef4444' };
const PRIORITY_COLORS = { High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e' };

export default function ZohoPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchTickets = () => {
    setLoading(true); setError('');
    api.get('/zoho/tickets-db')
      .then(r => setTickets(r.data.tickets || []))
      .catch(e => setError(e.response?.data?.error || 'Failed to load tickets'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTickets(); }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post('/zoho/sync');
      fetchTickets();
    } catch (e) {
      setError(e.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const statusCounts = Object.entries(
    tickets.reduce((acc, t) => { acc[t.status || 'Unknown'] = (acc[t.status || 'Unknown'] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name, value }));

  const priorityCounts = Object.entries(
    tickets.reduce((acc, t) => { acc[t.priority || 'Unknown'] = (acc[t.priority || 'Unknown'] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name, value }));

  const filtered = tickets.filter(t =>
    !search ||
    (t.subject || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.contact_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Zoho Desk</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Support tickets ({tickets.length} total)</p>
        </div>
        <button onClick={handleSync} disabled={syncing}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
          {syncing ? <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />Syncing…</> : 'Sync Tickets'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-400">{error}</div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: tickets.length, color: '#6366f1' },
          { label: 'Open', value: tickets.filter(t => t.status === 'Open').length, color: '#3b82f6' },
          { label: 'High Priority', value: tickets.filter(t => t.priority === 'High').length, color: '#ef4444' },
          { label: 'Closed', value: tickets.filter(t => t.status === 'Closed').length, color: '#22c55e' },
        ].map(s => (
          <div key={s.label} className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5">
            <p className="text-sm text-[var(--muted)] mb-1.5">{s.label}</p>
            <p className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6">
          <h3 className="font-semibold text-[var(--foreground)] mb-4">By Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label>
                {statusCounts.map(e => <Cell key={e.name} fill={STATUS_COLORS[e.name] || '#6366f1'} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6">
          <h3 className="font-semibold text-[var(--foreground)] mb-4">By Priority</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={priorityCounts}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {priorityCounts.map(e => <Cell key={e.name} fill={PRIORITY_COLORS[e.name] || '#6b7280'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <input type="text" placeholder="Search tickets…" value={search} onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-[var(--foreground)]" />

      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-[var(--muted)]">No tickets found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--muted-bg)] text-left">
                  {['Subject', 'Status', 'Priority', 'Contact', 'Created'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--card-border)]">
                {filtered.slice(0, 100).map((t, i) => (
                  <tr key={i} className="hover:bg-[var(--muted-bg)]">
                    <td className="px-4 py-3 font-medium text-[var(--foreground)] max-w-xs truncate">{t.subject || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{
                        backgroundColor: `${STATUS_COLORS[t.status] || '#6b7280'}20`,
                        color: STATUS_COLORS[t.status] || '#6b7280',
                      }}>{t.status || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{
                        backgroundColor: `${PRIORITY_COLORS[t.priority] || '#6b7280'}20`,
                        color: PRIORITY_COLORS[t.priority] || '#6b7280',
                      }}>{t.priority || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{t.contact_name || '—'}</td>
                    <td className="px-4 py-3 text-[var(--muted)] text-xs">{t.created_time ? new Date(t.created_time).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
