import { Routes, Route, Navigate } from 'react-router-dom';
import { OrgProvider, useOrg } from './context/OrgContext.jsx';
import { DashboardProvider } from './context/DashboardContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';

// Auth + core pages
import Login from './pages/Login.jsx';
import SelectOrganisation from './pages/SelectOrganisation.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Organisations from './pages/Organisations.jsx';
import Users from './pages/Users.jsx';
import ApiTokens from './pages/ApiTokens.jsx';
import ApiResponses from './pages/ApiResponses.jsx';
import Osint from './pages/Osint.jsx';
import Settings from './pages/Settings.jsx';
import AppLayout from './components/AppLayout.jsx';

// Security (SentinelOne)
import SecurityPage from './pages/security/SecurityPage.jsx';
import Threats from './pages/security/Threats.jsx';
import Agent from './pages/security/Agent.jsx';
import S1Agent from './pages/security/S1Agent.jsx';
import S1Cve from './pages/security/S1Cve.jsx';
import RiskyEndpoint from './pages/security/RiskyEndpoint.jsx';

// Integrations
import PaloAltoPage from './pages/paloalto/PaloAltoPage.jsx';
import CheckpointPage from './pages/checkpoint/CheckpointPage.jsx';
import ZohoPage from './pages/zoho/ZohoPage.jsx';

// Operations
import Projects from './pages/Projects.jsx';
import Reports from './pages/Reports.jsx';
import Analytics from './pages/Analytics.jsx';
import News from './pages/News.jsx';
import Support from './pages/Support.jsx';
import Notifications from './pages/Notifications.jsx';
import Billing from './pages/Billing.jsx';

// Members
import Members from './pages/Members.jsx';

// Admin
import AdminOrganizations from './pages/admin/AdminOrganizations.jsx';
import AdminOrgUsers from './pages/admin/AdminOrgUsers.jsx';

function ProtectedRoute({ children, requireSuperAdmin = false }) {
  const token = localStorage.getItem('ciso_token');
  if (!token) return <Navigate to="/login" replace />;
  if (requireSuperAdmin) {
    try {
      const user = JSON.parse(localStorage.getItem('ciso_user') || '{}');
      if (user.role !== 'superAdmin') return <Navigate to="/dashboard" replace />;
    } catch {
      return <Navigate to="/login" replace />;
    }
  }
  return children;
}

function OrgGate({ children }) {
  const { loading, currentOrg } = useOrg();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] text-[var(--muted)]">
        Loading…
      </div>
    );
  }

  // SuperAdmin can access all routes even without a selected org
  try {
    const user = JSON.parse(localStorage.getItem('ciso_user') || '{}');
    if (user.role === 'superAdmin') return children;
  } catch {}

  if (!currentOrg) {
    return <Navigate to="/select-organisation" replace />;
  }

  return children;
}

export default function App() {
  return (
    <ThemeProvider>
    <OrgProvider>
      <DashboardProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/select-organisation" element={<SelectOrganisation />} />

          <Route
            element={
              <ProtectedRoute>
                <OrgGate>
                  <AppLayout />
                </OrgGate>
              </ProtectedRoute>
            }
          >
            {/* Core */}
            <Route path="/dashboard"      element={<Dashboard />} />
            <Route path="/organisations"  element={<Organisations />} />
            <Route path="/tokens"         element={<ApiTokens />} />
            <Route path="/responses"      element={<ApiResponses />} />
            <Route path="/osint"          element={<Osint />} />
            <Route path="/settings"       element={<Settings />} />

            {/* Security (SentinelOne) */}
            <Route path="/security"               element={<SecurityPage />} />
            <Route path="/security/threats"       element={<Threats />} />
            <Route path="/security/agent"         element={<Agent />} />
            <Route path="/security/s1agent"       element={<S1Agent />} />
            <Route path="/security/s1cve"         element={<S1Cve />} />
            <Route path="/security/riskyendpoint" element={<RiskyEndpoint />} />

            {/* Integrations */}
            <Route path="/paloalto"   element={<PaloAltoPage />} />
            <Route path="/checkpoint" element={<CheckpointPage />} />
            <Route path="/zoho"       element={<ZohoPage />} />

            {/* Members */}
            <Route path="/members"        element={<Members />} />

            {/* Operations */}
            <Route path="/projects"       element={<Projects />} />
            <Route path="/reports"        element={<Reports />} />
            <Route path="/analytics"      element={<Analytics />} />
            <Route path="/news"           element={<News />} />
            <Route path="/support"        element={<Support />} />
            <Route path="/notifications"  element={<Notifications />} />
            <Route path="/billing"        element={<Billing />} />

            {/* Admin (superAdmin only) */}
            <Route
              path="/users"
              element={<ProtectedRoute requireSuperAdmin><Users /></ProtectedRoute>}
            />
            <Route
              path="/admin/organizations"
              element={<ProtectedRoute requireSuperAdmin><AdminOrganizations /></ProtectedRoute>}
            />
            <Route
              path="/admin/organizations/:id/users"
              element={<ProtectedRoute requireSuperAdmin><AdminOrgUsers /></ProtectedRoute>}
            />
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </DashboardProvider>
    </OrgProvider>
    </ThemeProvider>
  );
}
