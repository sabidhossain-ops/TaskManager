import { PRIORITY_TONE, STATUS_TONE } from '../../constants/task';
import { SLA_TONE } from '../../utils/sla';

const TONES = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  teal: 'bg-teal-50 text-teal-700 ring-teal-200',
  green: 'bg-green-50 text-green-700 ring-green-200',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
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

export const StatusBadge = ({ value }) => <Badge tone={STATUS_TONE[value]}>{value ?? '—'}</Badge>;
export const PriorityBadge = ({ value }) => <Badge tone={PRIORITY_TONE[value]}>{value ?? '—'}</Badge>;
export const SlaBadge = ({ value }) => <Badge tone={SLA_TONE[value]}>{value}</Badge>;
