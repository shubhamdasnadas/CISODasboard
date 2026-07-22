import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ProviderContext = createContext({
  selectedProviders: { edr: null, firewall: null, emailSecurity: null, ticketing: null, deviceManagement: null },
  setSelectedProvider: () => {},
  loading: true,
});

const STORAGE_KEY = 'ciso_selected_providers_v2';

export function ProviderProvider({ children }) {
  const [selectedProviders, setSelectedProvidersState] = useState({
    edr: null, firewall: null, emailSecurity: null, ticketing: null, deviceManagement: null
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          setSelectedProvidersState(prev => ({ ...prev, ...parsed }));
        }
      }
    } catch (e) {/* ignore */} finally {
      setLoading(false);
    }
  }, []);

  const setSelectedProvider = useCallback((category, providerName) => {
    setSelectedProvidersState(prev => {
      const updated = { ...prev, [category]: providerName };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {/* ignore */}
      return updated;
    });
  }, []);

  return (
    <ProviderContext.Provider value={{ selectedProviders, setSelectedProvider, loading }}>
      {children}
    </ProviderContext.Provider>
  );
}

export function useProviders() {
  return useContext(ProviderContext);
}