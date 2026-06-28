import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api';

const OrgContext = createContext({
  organisations: [],
  currentOrg: null,        // full org object
  loading: true,
  setCurrentOrg: () => {},
  switchOrg: () => {},
  refresh: () => {},
});

const STORAGE_KEY = 'ciso_current_org_id';

export function OrgProvider({ children }) {
  const [organisations, setOrganisations] = useState([]);
  const [currentOrg, setCurrentOrgState] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/organisations');
      const list = data.organisations || [];
      setOrganisations(list);

      // Restore previous selection ONLY if it still belongs to this user.
      // Otherwise leave currentOrg null so the user is forced to the picker.
      const savedId = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
      const found = list.find((o) => o.id === savedId);
      if (found) {
        setCurrentOrgState(found);
      } else {
        setCurrentOrgState(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (localStorage.getItem('ciso_token')) {
      refresh();
    } else {
      setLoading(false);
    }
  }, [refresh]);

  // Single source of truth: writes BOTH context state AND localStorage.
  // Pass the full org object (not just an id) so we don't depend on the
  // organisations list being loaded yet.
  const setCurrentOrg = useCallback((org) => {
    if (org) {
      setCurrentOrgState(org);
      localStorage.setItem(STORAGE_KEY, String(org.id));
    } else {
      setCurrentOrgState(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Convenience: lookup by id, then set. Use this from pickers where the
  // org list is already loaded (e.g. OrgSwitcher dropdown).
  const switchOrg = useCallback((orgId) => {
    setOrganisations((prev) => {
      const found = prev.find((o) => o.id === orgId);
      if (found) setCurrentOrg(found);
      return prev;
    });
  }, [setCurrentOrg]);

  return (
    <OrgContext.Provider value={{ organisations, currentOrg, loading, setCurrentOrg, switchOrg, refresh }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  return useContext(OrgContext);
}