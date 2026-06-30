import { useState, useEffect } from 'react';
import api from '../../api.js';
import { WIDGET_OPTIONS } from './helpers.js';

function buildSummary(events, types) {
  const filtered = events.filter((e) => types.includes(e.type));
  const total = filtered.length;
  const pending = filtered.filter((e) => e.state === 'new' || e.state === 'pending').length;
  const remediated = filtered.filter((e) => ['remediated', 'closed', 'done'].includes(e.state)).length;
  const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return { total, pending, remediated, remediatedPct: pct(remediated), pendingPct: pct(pending) };
}

export default function CheckpointWidgetPicker({ selected, onToggle, onAdd, onCancel }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/harmony/events-db')
      .then((r) => { if (Array.isArray(r.data?.responseData)) setEvents(r.data.responseData); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-5">
      <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-3">
        Select Checkpoint Widgets to Add
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {WIDGET_OPTIONS.map((opt) => {
            const isSelected = selected.includes(opt.id);
            const summary = buildSummary(events, opt.eventTypes);
            return (
              <button
                key={opt.id}
                onClick={() => onToggle(opt.id)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-400 dark:border-indigo-600 shadow-sm'
                    : 'bg-[var(--muted-bg)] border-[var(--card-border)] hover:border-indigo-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-bold ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-[var(--foreground)]'}`}>
                    {opt.label}
                  </span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-[var(--input-border)]'}`}>
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-[var(--muted)] mb-2">{opt.description}</p>
                {summary.total > 0 ? (
                  <div className="flex items-center gap-3 mt-2">
                    <div className="text-center">
                      <p className="text-base font-bold text-blue-600 dark:text-blue-400 leading-none">{summary.total}</p>
                      <p className="text-[9px] text-[var(--muted)] mt-0.5">Total</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-sm font-bold leading-none ${summary.remediatedPct > 0 ? 'text-green-600 dark:text-green-400' : 'text-[var(--muted)]'}`}>{summary.remediatedPct}%</p>
                      <p className="text-[9px] text-[var(--muted)] mt-0.5">Remediated</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-sm font-bold leading-none ${summary.pending > 0 ? 'text-red-500' : 'text-[var(--muted)]'}`}>{summary.pendingPct}%</p>
                      <p className="text-[9px] text-[var(--muted)] mt-0.5">Pending</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-[var(--muted)] mt-1">No events yet</p>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-5 flex items-center justify-end gap-2 border-t border-[var(--card-border)] pt-4">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--muted)] hover:bg-[var(--muted-bg)] transition-colors">
          Cancel
        </button>
        <button
          onClick={() => onAdd(selected)}
          disabled={selected.length === 0}
          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 dark:disabled:bg-indigo-900 text-white transition-colors shadow-sm disabled:cursor-not-allowed"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Add {selected.length > 0 ? `${selected.length} Widget${selected.length > 1 ? 's' : ''}` : 'Widgets'}
        </button>
      </div>
    </div>
  );
}
