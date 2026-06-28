import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [userStatus, setUserStatus] = useState({ checked: false, exists: false, organisations: [] });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  // If already logged in, jump to org selection (which may auto-pick)
  useEffect(() => {
    const token = localStorage.getItem('ciso_token');
    if (token) navigate('/select-organisation');
  }, [navigate]);

  // Debounced username check — 500ms after typing stops
  useEffect(() => {
    if (!username) {
      setUserStatus({ checked: false, exists: false, organisations: [] });
      setShowPassword(false);
      setError('');
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.post('/auth/check-username', { username });
        setUserStatus({ checked: true, ...data });
        setShowPassword(Boolean(data.exists));
        setError(data.exists ? '' : 'Username not found');
      } catch (err) {
        // Log the full axios error to the browser console for diagnosis.
        // The message you see in the UI comes from one of three branches:
        //   1. backend returned a 500 with a `detail` field      → "Server error: <detail>"
        //   2. backend returned a 500 with a plain `error` field → "Server error: <error>"
        //   3. request never reached the backend (network/CORS/proxy) → "<statusText or code>"
        console.error('[check-username] failed:', err);
        const body = err.response?.data;
        if (body?.detail) {
          setError(`Server error: ${body.detail}`);
        } else if (body?.error) {
          setError(`Server error: ${body.error}`);
        } else if (err.response) {
          setError(`Server returned ${err.response.status}: ${err.response.statusText || 'no body'}`);
        } else if (err.code === 'ERR_NETWORK') {
          setError('Network error: is the backend running on http://localhost:5000?');
        } else {
          setError(`Cannot reach server (${err.code || err.message || 'unknown error'})`);
        }
      }
    }, 500);
    return () => clearTimeout(debounceRef.current);
  }, [username]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { username, password });
      localStorage.setItem('ciso_token', data.token);
      localStorage.setItem('ciso_user', JSON.stringify(data.user));
      // Clear any stale org selection from a previous session
      localStorage.removeItem('ciso_current_org_id');
      navigate('/select-organisation');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-900 p-6">
      <div className="w-full max-w-md bg-navy-800 rounded-3xl p-8 border border-navy-700 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-2xl">
            🛡️
          </div>
          <div>
            <h1 className="text-2xl font-bold">CISO Dashboard</h1>
            <p className="text-muted text-sm">Sign in to continue</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label className="text-sm text-muted">Username</label>
            <div className="relative mt-1">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full px-4 py-3 pr-10 rounded-xl bg-navy-700 border border-navy-700 focus:border-accent focus:outline-none text-white placeholder-muted"
                autoFocus
              />
              {userStatus.checked && userStatus.exists && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400">✓</span>
              )}
            </div>
          </div>

          {/* Status / orgs */}
          {userStatus.checked && !userStatus.exists && (
            <div className="text-rose-400 text-sm">✗ Username not found</div>
          )}

          {userStatus.exists && userStatus.organisations.length > 0 && (
            <div className="bg-navy-700 rounded-xl p-4">
              <div className="text-sm text-muted mb-2">Connected organisations</div>
              <div className="flex flex-wrap gap-2">
                {userStatus.organisations.map((o) => (
                  <span
                    key={o.id}
                    className="px-3 py-1 rounded-full bg-accent/20 text-accent text-sm border border-accent/40"
                  >
                    {o.org_name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Password */}
          {showPassword && (
            <div>
              <label className="text-sm text-muted">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 mt-1 rounded-xl bg-navy-700 border border-navy-700 focus:border-accent focus:outline-none text-white placeholder-muted"
              />
            </div>
          )}

          {error && <div className="text-rose-400 text-sm">{error}</div>}

          <button
            type="submit"
            disabled={!showPassword || !password || loading}
            className="w-full py-3 rounded-xl bg-accent hover:bg-accent-600 disabled:opacity-50 font-semibold transition"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-xs text-muted text-center">
          Seed users: <span className="text-white">Shubham</span>, <span className="text-white">Ramesh</span>, <span className="text-white">Radhesh</span>, <span className="text-white">Raju</span>
        </div>
      </div>
    </div>
  );
}