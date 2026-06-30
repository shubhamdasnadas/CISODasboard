import { useState } from 'react';
import { S1_WIDGET_DEFS } from './helpers.js';

export default function SentinelOneWidgetPicker({ selected, onToggle, onAdd, onCancel }) {
  // Per-widget local viewMode toggle (graph vs table)
  const [viewModes, setViewModes] = useState(() => {
    const m = {};
    S1_WIDGET_DEFS.forEach((d) => { m[d.id] = d.defaultViewMode; });
    return m;
  });

  function setMode(id, mode) {
    setViewModes((prev) => ({ ...prev, [id]: mode }));
  }

  function handleAdd() {
    const configs = selected.map((id) => ({
      id,
      viewMode: viewModes[id] ?? 'table',
    }));
    onAdd(configs);
  }

  return (
    <div className="p-5">
      <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-3">
        Select SentinelOne Widgets to Add
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {S1_WIDGET_DEFS.map((def) => {
          const isSelected = selected.includes(def.id);
          const mode = viewModes[def.id] ?? def.defaultViewMode;
          const supportsGraph = !['s1-mitigation', 's1-severity', 's1-threats', 's1-agents', 's1-rss'].includes(def.id);

          return (
            <div
              key={def.id}
              className={`rounded-xl border transition-all ${isSelected
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400 dark:border-emerald-600 shadow-sm'
                : 'bg-[var(--muted-bg)] border-[var(--card-border)] hover:border-emerald-300'
              }`}
            >
              <button
                className="w-full text-left p-4 pb-2"
                onClick={() => onToggle(def.id)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-bold ${isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-[var(--foreground)]'}`}>
                    {def.label}
                  </span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-emerald-600 bg-emerald-600' : 'border-[var(--input-border)]'}`}>
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-[var(--muted)]">{def.description}</p>
              </button>

              {supportsGraph && (
                <div className="px-4 pb-3 flex items-center gap-1">
                  <span className="text-[9px] text-[var(--muted)] mr-1">View:</span>
                  <button
                    onClick={() => setMode(def.id, 'table')}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${mode === 'table' ? 'bg-blue-500 text-white' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}
                  >
                    Table
                  </button>
                  <button
                    onClick={() => setMode(def.id, 'graph')}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${mode === 'graph' ? 'bg-emerald-500 text-white' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}
                  >
                    Graph
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-end gap-2 border-t border-[var(--card-border)] pt-4">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--muted)] hover:bg-[var(--muted-bg)] transition-colors">
          Cancel
        </button>
        <button
          onClick={handleAdd}
          disabled={selected.length === 0}
          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 dark:disabled:bg-emerald-900 text-white transition-colors shadow-sm disabled:cursor-not-allowed"
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
