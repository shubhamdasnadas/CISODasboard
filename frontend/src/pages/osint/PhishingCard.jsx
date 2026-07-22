import { useState } from 'react';
import { Badge } from '../../components/UI.jsx';

function dayKey(d) {
  return new Date(d).toDateString();
}

// Most recent fetch per calendar day, keyed by that day's date string.
function latestPerDay(history) {
  const map = new Map();
  (history || [])
    .filter((h) => !h.response_data?.error)
    .forEach((h) => {
      const key = dayKey(h.fetched_at);
      const existing = map.get(key);
      if (!existing || new Date(h.fetched_at) > new Date(existing.fetched_at)) {
        map.set(key, h);
      }
    });
  return map;
}

export default function PhishingCard({ latest, history }) {
  const [open, setOpen] = useState(false);

  if (!latest) return <div className="text-xs text-muted">Not fetched yet.</div>;
  if (latest.response_data?.error) {
    return <div className="text-xs text-rose-400">{latest.response_data.message}</div>;
  }

  const byDay = latestPerDay(history);
  const todayEntry = byDay.get(dayKey(Date.now()));
  const yesterdayEntry = byDay.get(dayKey(Date.now() - 86400000));

  // No fetch yet today — fall back to the latest fetch available so the
  // card still shows a number, just labeled with when it's actually from.
  const displayEntry = todayEntry || latest;
  const displayCount = displayEntry.response_data?.data?.incidentCount ?? 0;
  const isToday = !!todayEntry;

  const todayCount = todayEntry?.response_data?.data?.incidentCount;
  const yesterdayCount = yesterdayEntry?.response_data?.data?.incidentCount;
  const delta = todayCount != null && yesterdayCount != null ? todayCount - yesterdayCount : null;

  const samples = displayEntry.response_data?.data?.samples || [];

  return (
    <>
      <div className="flex items-end gap-2 mb-1">
        <div className="text-3xl font-bold">{displayCount}</div>
        <div className="text-xs text-muted mb-1">
          {isToday ? 'incidents today' : `incidents (last fetch ${new Date(displayEntry.fetched_at).toLocaleDateString()})`}
        </div>
      </div>

      <div className="mb-3">
        {delta == null ? (
          <span className="text-xs text-muted">No fetch from yesterday to compare against</span>
        ) : delta === 0 ? (
          <Badge color="gray">No change vs yesterday</Badge>
        ) : delta > 0 ? (
          <Badge color="red">▲ {delta} vs yesterday</Badge>
        ) : (
          <Badge color="green">▼ {Math.abs(delta)} vs yesterday</Badge>
        )}
      </div>

      {samples.length > 0 && (
        <div className="mb-2">
          <button onClick={() => setOpen((o) => !o)} className="text-xs text-accent hover:underline">
            {open ? '▲ Hide' : '▼ View'} phishing URLs ({samples.length})
          </button>
          {open && (
            <div className="text-xs max-h-32 overflow-auto space-y-1 mt-2">
              {samples.map((s, i) => (
                <div key={i} className="font-mono text-muted truncate">{s.url}</div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="text-xs text-muted">
        Fetched: <Badge color="green">{new Date(latest.fetched_at).toLocaleString()}</Badge>
      </div>
    </>
  );
}
