import { findPriority, findStatus } from '../../constants/task';

const TONES = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  green: 'bg-green-50 text-green-700 ring-green-200',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
};

export default function Badge({ tone = 'slate', children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${TONES[tone] ?? TONES.slate}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ value }) {
  const s = findStatus(value);
  return <Badge tone={s?.tone}>{s?.label ?? value ?? '—'}</Badge>;
}

export function PriorityBadge({ value }) {
  const p = findPriority(value);
  return <Badge tone={p?.tone}>{p?.label ?? value ?? '—'}</Badge>;
}
