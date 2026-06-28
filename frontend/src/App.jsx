import { Routes, Route, Navigate } from 'react-router-dom';
import { OrgProvider, useOrg } from './context/OrgContext.jsx';
import Login from './pages/Login.jsx';
import SelectOrganisation from './pages/SelectOrganisation.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Organisations from './pages/Organisations.jsx';
import Users from './pages/Users.jsx';
import ApiTokens from './pages/ApiTokens.jsx';
import ApiResponses from './pages/ApiResponses.jsx';
import AppLayout from './components/AppLayout.jsx';

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

// Gate that requires an organisation to be selected.
// If currentOrg isn't set yet (or isn't valid for this user) → /select-organisation.
function OrgGate({ children }) {
  const { loading, currentOrg } = useOrg();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-900 text-muted">
        Loading…
      </div>
    );
  }

  if (!currentOrg) {
    return <Navigate to="/select-organisation" replace />;
  }

  return children;
}

export default function App() {
  return (
    <OrgProvider>
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
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/organisations" element={<Organisations />} />
          <Route
            path="/users"
            element={
              <ProtectedRoute requireSuperAdmin>
                <Users />
              </ProtectedRoute>
            }
          />
          <Route path="/tokens" element={<ApiTokens />} />
          <Route path="/responses" element={<ApiResponses />} />
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </OrgProvider>
  );
}