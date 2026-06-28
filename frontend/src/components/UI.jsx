export function Card({ children, className = '' }) {
  return (
    <div className={`bg-navy-800 rounded-2xl p-6 border border-navy-700 ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        {subtitle && <p className="text-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function PrimaryButton({ children, onClick, disabled, type = 'button', className = '' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-600 disabled:opacity-50 font-medium transition ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, type = 'button', className = '' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`px-5 py-2.5 rounded-xl bg-navy-700 hover:bg-navy-800 font-medium transition ${className}`}
    >
      {children}
    </button>
  );
}

export function Input({ ...props }) {
  return (
    <input
      {...props}
      className={`w-full px-4 py-3 rounded-xl bg-navy-700 border border-navy-700 focus:border-accent focus:outline-none text-white placeholder-muted ${props.className || ''}`}
    />
  );
}

export function Select({ children, ...props }) {
  return (
    <select
      {...props}
      className={`w-full px-4 py-3 rounded-xl bg-navy-700 border border-navy-700 focus:border-accent focus:outline-none text-white ${props.className || ''}`}
    >
      {children}
    </select>
  );
}

export function Badge({ children, color = 'accent' }) {
  const colors = {
    accent: 'bg-accent/20 text-accent border border-accent/40',
    green:  'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    red:    'bg-rose-500/20 text-rose-300 border border-rose-500/40',
    gray:   'bg-navy-700 text-muted border border-navy-700',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${colors[color] || colors.accent}`}>
      {children}
    </span>
  );
}

export function StatCard({ label, value, accent = false }) {
  return (
    <Card>
      <div className="text-muted text-sm">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${accent ? 'text-accent' : 'text-white'}`}>{value}</div>
    </Card>
  );
}