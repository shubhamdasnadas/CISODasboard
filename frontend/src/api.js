import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Restore active org from localStorage so the header survives page refreshes
const _savedOrgId = localStorage.getItem('ciso_current_org_id');
if (_savedOrgId) {
  api.defaults.headers.common['X-Org-Id'] = _savedOrgId;
}

// Attach JWT + active org to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ciso_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ciso_token');
      localStorage.removeItem('ciso_user');
      localStorage.removeItem('ciso_current_org_id');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;