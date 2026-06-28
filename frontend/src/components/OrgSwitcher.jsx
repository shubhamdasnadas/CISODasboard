import { useState, useRef, useEffect } from 'react';
import { useOrg } from '../context/OrgContext.jsx';

export default function OrgSwitcher() {
  const { organisations, currentOrg, setCurrentOrg, switchOrg } = useOrg();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  if (!currentOrg) return null;

  function pick(org) {
    setCurrentOrg(org);   // updates context + localStorage in one shot
    setOpen(false);
  }

  // If the user only has one org, show a static chip
  if (organisations.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-navy-700 border border-navy-700">
        <span className="text-accent">🏢</span>
        <span className="font-medium">{currentOrg.org_name}</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-navy-700 border border-navy-700 hover:border-accent/50 transition"
      >
        <span className="text-accent">🏢</span>
        <span className="font-medium">{currentOrg.org_name}</span>
        <span className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-navy-800 border border-navy-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-2 text-xs uppercase tracking-wide text-muted border-b border-navy-700">
            Switch organisation
          </div>
          <div className="max-h-80 overflow-y-auto">
            {organisations.map((o) => {
              const isActive = o.id === currentOrg.id;
              return (
                <button
                  key={o.id}
                  onClick={() => pick(o)}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-navy-700 transition ${
                    isActive ? 'bg-accent/10' : ''
                  }`}
                >
                  <div>
                    <div className="font-medium">{o.org_name}</div>
                    {o.address && (
                      <div className="text-xs text-muted truncate max-w-[14rem]">
                        {o.address}
                      </div>
                    )}
                  </div>
                  {isActive && <span className="text-accent">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}