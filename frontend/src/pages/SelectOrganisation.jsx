import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrg } from '../context/OrgContext.jsx';

export default function SelectOrganisation() {
  const navigate = useNavigate();
  const { organisations, currentOrg, loading: ctxLoading, setCurrentOrg, refresh } = useOrg();
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  // Single source of truth: OrgContext. Force a refresh every time this
  // page mounts so the user ALWAYS sees their CURRENT user's org list —
  // not whatever list was cached from a previous session or previous user.
  useEffect(() => {
    if (!localStorage.getItem('ciso_token')) {
      navigate('/login', { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } catch {
        if (!cancelled) setError('Failed to load your organisations. Please try again.');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the context has loaded the org list, decide what to show.
  useEffect(() => {
    if (ctxLoading) return;
    if (organisations.length === 0) {
      setError('No organisations are linked to your account. Please contact your administrator.');
      return;
    }
    // If only one org and nothing is selected yet, auto-pick it.
    if (organisations.length === 1 && !currentOrg) {
      setCurrentOrg(organisations[0]);
      navigate('/dashboard', { replace: true });
    }
  }, [ctxLoading, organisations, currentOrg, setCurrentOrg, navigate]);

  function pickOrg(org) {
    setCurrentOrg(org);              // updates context state + localStorage
    navigate('/dashboard', { replace: true });
  }

  async function logout() {
    localStorage.removeItem('ciso_token');
    localStorage.removeItem('ciso_user');
    localStorage.removeItem('ciso_current_org_id');
    setCurrentOrg(null);
    navigate('/login', { replace: true });
  }

  if (ctxLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-900 text-muted">
        Loading organisations…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-900 p-6">
      <div className="w-full max-w-2xl bg-navy-800 rounded-3xl p-8 border border-navy-700 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-2xl">
            🏢
          </div>
          <div>
            <h1 className="text-2xl font-bold">Select Organisation</h1>
            <p className="text-muted text-sm">
              Choose which organisation you want to work with
            </p>
          </div>
        </div>

        {error ? (
          <div className="bg-rose-500/10 border border-rose-500/40 text-rose-300 rounded-xl p-4 text-sm">
            {error}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {organisations.map((o) => {
                const isSelected = selectedId === o.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => setSelectedId(o.id)}
                    className={`text-left p-5 rounded-2xl border transition ${
                      isSelected
                        ? 'bg-accent/10 border-accent shadow-lg shadow-accent/10'
                        : 'bg-navy-700 border-navy-700 hover:border-accent/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-lg">{o.org_name}</div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-accent bg-accent' : 'border-navy-600'
                        }`}
                      >
                        {isSelected && <span className="text-white text-xs">✓</span>}
                      </div>
                    </div>
                    {o.address && (
                      <div className="text-xs text-muted">📍 {o.address}</div>
                    )}
                    {o.mobile_no && (
                      <div className="text-xs text-muted">📞 {o.mobile_no}</div>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => {
                const chosen = organisations.find((o) => o.id === selectedId);
                if (chosen) pickOrg(chosen);
              }}
              disabled={!selectedId}
              className="w-full py-3 rounded-xl bg-accent hover:bg-accent-600 disabled:opacity-50 font-semibold transition"
            >
              Continue →
            </button>
          </>
        )}

        <button
          onClick={logout}
          className="w-full mt-4 py-2 text-sm text-muted hover:text-white"
        >
          🚪 Sign out
        </button>
      </div>
    </div>
  );
}