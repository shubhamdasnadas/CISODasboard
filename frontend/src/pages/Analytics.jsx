import { useState, useEffect } from 'react';
import api from '../api';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const COLORS = ['#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4'];

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);

  const activeDays7d = (data?.dailyStats || []).filter(d => {
    const dt = new Date(d._id);
    return dt >= sevenDaysAgo && dt <= today;
  }).length;

  const stats = [
    { label: 'Total Events', value: data?.totalEvents ?? 0, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
    { label: 'Unique Pages', value: data?.pageStats?.length ?? 0, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20' },
    { label: 'Active Days (7d)', value: activeDays7d, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  ];

  const chartData = (data?.dailyStats || []).slice(-30);
  const topPages = (data?.pageStats || []).slice(0, 6);
  const topUsers = (data?.topUsers || []).slice(0, 8);
  const maxPageCount = topPages[0]?.count || 1;

  if (loading) return (
    <div className="p-8 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Analytics</h1>
        <p className="text-sm text-[var(--muted)] mt-1">Usage statistics and activity</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-6 border border-transparent`}>
            <p className="text-sm font-medium text-[var(--muted)]">{s.label}</p>
            <p className={`text-4xl font-bold mt-2 ${s.color}`}>{s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily events chart */}
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6">
          <h3 className="font-semibold text-[var(--foreground)] mb-4">Events per Day (last 30 days)</h3>
          {chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-[var(--muted)] text-sm">No data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="_id" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={45} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top pages */}
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--card-border)]">
            <h3 className="font-semibold text-[var(--foreground)]">Top Pages</h3>
          </div>
          <div className="divide-y divide-[var(--card-border)]">
            {topPages.length === 0 ? (
              <div className="p-8 text-center text-[var(--muted)] text-sm">No page data yet.</div>
            ) : topPages.map((p, i) => (
              <div key={p._id} className="flex items-center gap-3 px-6 py-3">
                <span className="text-xs font-bold text-[var(--muted)] w-5">{i + 1}</span>
                <span className="text-sm text-[var(--foreground)] flex-1 truncate font-mono">{p._id}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-[var(--muted-bg)] rounded-full h-2">
                    <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${Math.round((p.count / maxPageCount) * 100)}%` }} />
                  </div>
                  <span className="text-sm text-[var(--muted)] w-8 text-right">{p.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Most active users */}
      {topUsers.length > 0 && (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6">
          <h3 className="font-semibold text-[var(--foreground)] mb-4">Most Active Users</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topUsers} margin={{ top: 5, right: 10, left: -20, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
              <XAxis dataKey="_id" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {topUsers.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
