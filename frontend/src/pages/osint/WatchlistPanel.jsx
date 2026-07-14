import { useState } from 'react';
import api from '../../api';
import { Card, PrimaryButton, Input, Select, Badge } from '../../components/UI.jsx';

export default function WatchlistPanel({ orgId, watchlist, isAdmin, onChange }) {
  const [open, setOpen] = useState(watchlist.length === 0);
  const [form, setForm] = useState({ type: 'domain', value: '', is_primary: false });

  async function submit(e) {
    e.preventDefault();
    if (!form.value.trim()) return;
    try {
      await api.post('/osint-watchlist', { org_id: orgId, ...form, value: form.value.trim() });
      setForm({ type: 'domain', value: '', is_primary: false });
      onChange();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add');
    }
  }

  async function setPrimary(entry) {
    await api.patch(`/osint-watchlist/${entry.id}/primary`, { org_id: orgId, type: entry.type });
    onChange();
  }

  async function remove(id) {
    if (!confirm('Remove this watchlist entry?')) return;
    await api.delete(`/osint-watchlist/${id}?org_id=${orgId}`);
    onChange();
  }

  return (
    <Card className="mb-6">
      <div className="flex justify-between items-center cursor-pointer" onClick={() => setOpen((o) => !o)}>
        <h3 className="font-semibold">OSINT Watchlist</h3>
        <span className="text-xs text-muted">{open ? 'Hide' : 'Show'}</span>
      </div>
      <p className="text-xs text-muted mt-1">
        Domains, IPs, and keywords used by OSINT lookups. Without entries here, tools query generic sample values.
      </p>

      {open && (
        <div className="mt-4">
          {isAdmin && (
            <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="domain">Domain</option>
                <option value="ip">IP</option>
                <option value="keyword">Keyword</option>
              </Select>
              <Input
                className="md:col-span-2"
                placeholder={form.type === 'domain' ? 'yourcompany.com' : form.type === 'ip' ? '1.2.3.4' : 'Brand or vendor name'}
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                required
              />
              <PrimaryButton type="submit">+ Add</PrimaryButton>
              <label className="flex items-center gap-2 text-xs text-muted md:col-span-4">
                <input
                  type="checkbox"
                  checked={form.is_primary}
                  onChange={(e) => setForm({ ...form, is_primary: e.target.checked })}
                />
                Set as primary {form.type}
              </label>
            </form>
          )}

          <table className="w-full text-left text-sm">
            <thead className="text-muted text-xs border-b border-navy-700">
              <tr><th className="py-2">Type</th><th>Value</th><th></th>{isAdmin && <th></th>}</tr>
            </thead>
            <tbody>
              {watchlist.map((w) => (
                <tr key={w.id} className="border-b border-navy-700 last:border-0">
                  <td className="py-2 capitalize">{w.type}</td>
                  <td className="font-mono">{w.value}</td>
                  <td>
                    {w.is_primary
                      ? <Badge color="accent">Primary</Badge>
                      : isAdmin && <button className="text-xs text-muted hover:text-white" onClick={() => setPrimary(w)}>Set primary</button>}
                  </td>
                  {isAdmin && (
                    <td className="text-right">
                      <button onClick={() => remove(w.id)} className="text-rose-400 hover:text-rose-300 text-xs">Delete</button>
                    </td>
                  )}
                </tr>
              ))}
              {watchlist.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-muted text-xs">No watchlist entries yet — tools use generic sample values.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
