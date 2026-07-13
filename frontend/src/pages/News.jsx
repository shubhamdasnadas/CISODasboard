import { useState, useEffect, useCallback } from 'react';
import api from '../api';

function SkeletonCard() {
  return (
    <div className="animate-pulse bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5">
      <div className="h-4 bg-[var(--muted-bg)] rounded w-3/4 mb-3" />
      <div className="h-3 bg-[var(--muted-bg)] rounded w-full mb-2" />
      <div className="h-3 bg-[var(--muted-bg)] rounded w-5/6 mb-4" />
      <div className="flex gap-3">
        <div className="h-3 bg-[var(--muted-bg)] rounded w-20" />
        <div className="h-3 bg-[var(--muted-bg)] rounded w-24" />
      </div>
    </div>
  );
}

export default function News() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    api.get('/news?limit=50')
      .then(r => setArticles(r.data.articles || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="p-6 lg:p-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">News</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Security news and alerts{!loading && articles.length > 0 ? ` · ${articles.length} articles` : ''}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center p-16 text-[var(--muted)]">No news articles found.</div>
      ) : (
        <div className="space-y-4">
          {articles.map((a, i) => (
            <div key={i} className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--foreground)] hover:text-indigo-600 transition-colors">
                      {a.title}
                    </a>
                  ) : (
                    <p className="font-semibold text-[var(--foreground)]">{a.title}</p>
                  )}
                  {a.description && <p className="text-sm text-[var(--muted)] mt-1 line-clamp-3">{a.description}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    {a.source && <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{a.source}</span>}
                    {a.published_at && <span className="text-xs text-[var(--muted)]">{new Date(a.published_at).toLocaleDateString()}</span>}
                  </div>
                </div>
                {a.url && (
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-[var(--muted)] hover:text-indigo-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
