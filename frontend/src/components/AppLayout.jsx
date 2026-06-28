import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import OrgSwitcher from './OrgSwitcher.jsx';
import { useOrg } from '../context/OrgContext.jsx';

function NavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 rounded-xl transition ${
          isActive
            ? 'bg-accent text-white shadow-lg'
            : 'text-muted hover:bg-navy-700 hover:text-white'
        }`
      }
    >
      <span className="text-xl">{icon}</span>
      <span className="font-medium">{label}</span>
    </NavLink>
  );
}

export default function AppLayout() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('ciso_user') || '{}');
  const { organisations, currentOrg, setCurrentOrg } = useOrg();

  function logout() {
    localStorage.removeItem('ciso_token');
    localStorage.removeItem('ciso_user');
    localStorage.removeItem('ciso_current_org_id');
    setCurrentOrg(null);   // <-- also clear in-memory context state
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-navy-900 text-white">
      {/* Sidebar */}
      <aside className="w-64 bg-navy-800 p-5 flex flex-col gap-2 border-r border-navy-700">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center font-bold">
            🛡️
          </div>
          <div>
            <div className="font-bold text-lg">CISO</div>
            <div className="text-xs text-muted">Dashboard</div>
          </div>
        </div>

        <NavItem to="/dashboard"      icon="📊" label="Dashboard" />
        <NavItem to="/organisations"  icon="🏢" label="Organisations" />
        {user.role === 'superAdmin' && (
          <NavItem to="/users"        icon="👥" label="Users" />
        )}
        <NavItem to="/tokens"         icon="🔑" label="API Tokens" />
        <NavItem to="/responses"      icon="📡" label="API Responses" />

        <div className="mt-auto pt-4 border-t border-navy-700">
          <div className="px-4 py-2 text-sm text-muted">
            <div className="font-semibold text-white">{user.username}</div>
            <div className="capitalize">{user.role}</div>
          </div>
          <button
            onClick={logout}
            className="w-full mt-2 px-4 py-2 text-left rounded-xl text-muted hover:bg-navy-700 hover:text-white"
          >
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {/* Top bar with org switcher */}
        <div className="sticky top-0 z-40 bg-navy-900/80 backdrop-blur border-b border-navy-700 px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="text-white font-semibold">
              {currentOrg?.org_name || '—'}
            </span>
            <span>•</span>
            <span>
              {organisations.length} organisation{organisations.length === 1 ? '' : 's'} linked
            </span>
          </div>
          <OrgSwitcher />
        </div>

        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
