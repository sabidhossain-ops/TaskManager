/** Simple horizontal bars. `items` = [{ label, value }] */
export default function BarList({ items, loading, barClass = 'bg-brand-500', empty = 'No data yet.' }) {
  if (loading)
    return (
      <ul className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="h-3 animate-pulse rounded bg-slate-200" />
        ))}
      </ul>
    );
  if (!items.length) return <p className="py-4 text-sm text-slate-500">{empty}</p>;

  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5">
      {items.map(({ label, value }) => (
        <li key={label} className="grid grid-cols-[minmax(6rem,9rem)_1fr_2.5rem] items-center gap-3 text-sm">
          <span className="truncate text-slate-600" title={label}>{label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <span className={`block h-full rounded-full ${barClass}`} style={{ width: `${(value / max) * 100}%` }} />
          </span>
          <span className="text-right font-medium text-slate-900 tabular-nums">{value}</span>
        </li>
      ))}
    </ul>
  );
}
