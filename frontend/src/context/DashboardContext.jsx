import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api';
import { useOrg } from './OrgContext';

const DashboardContext = createContext({
  sentinelCreds: null,
  firewallCreds: null,
  harmonyCreds: null,
  loadingCreds: true,
  refreshCreds: () => {},
});

export function DashboardProvider({ children }) {
  const { currentOrg } = useOrg();
  const [sentinelCreds, setSentinelCreds] = useState(null);
  const [firewallCreds, setFirewallCreds] = useState(null);
  const [harmonyCreds, setHarmonyCreds] = useState(null);
  const [loadingCreds, setLoadingCreds] = useState(true);

  const refreshCreds = useCallback(async () => {
    if (!currentOrg) return;
    setLoadingCreds(true);
    try {
      const [s1, fw, cp] = await Promise.all([
        api.get('/sentinelone/credentials').catch(() => ({ data: {} })),
        api.get('/firewall/credentials').catch(() => ({ data: {} })),
        api.get('/harmony/credentials').catch(() => ({ data: {} })),
      ]);
      setSentinelCreds(s1.data);
      setFirewallCreds(fw.data);
      setHarmonyCreds(cp.data);
    } catch {
      // silently ignore — credentials may not be set yet
    } finally {
      setLoadingCreds(false);
    }
  }, [currentOrg]);

  useEffect(() => {
    refreshCreds();
  }, [refreshCreds]);

  return (
    <DashboardContext.Provider value={{ sentinelCreds, firewallCreds, harmonyCreds, loadingCreds, refreshCreds }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  return useContext(DashboardContext);
}
