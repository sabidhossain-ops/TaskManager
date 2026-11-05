const ACCENTS = {
  brand: 'bg-brand-50 text-brand-600',
  amber: 'bg-amber-50 text-amber-600',
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
};

export default function StatCard({ label, value, icon: Icon, accent = 'brand', loading, footnote }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          {loading ? (
            <div className="mt-2 h-8 w-16 animate-pulse rounded bg-slate-200" />
          ) : (
            <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
          )}
        </div>
        {Icon && (
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${ACCENTS[accent]}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      {footnote && !loading && <p className="mt-3 text-xs text-slate-500">{footnote}</p>}
    </div>
  );
}
