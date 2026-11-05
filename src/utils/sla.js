import { DEFAULT_SLA_MINUTES, OPEN_STATUSES } from '../constants/task';

const ms = (v) => (v ? new Date(v).getTime() : null);

export const isOpen = (t) => OPEN_STATUSES.includes(t.status);
export const isOverdue = (t, now = Date.now()) => isOpen(t) && now > ms(t.deadline);

/** 'SLA Met' | 'SLA Breached' | 'At Risk' | 'Within SLA' | '—' (cancelled) */
export function slaState(t, slaMinutes = DEFAULT_SLA_MINUTES, now = Date.now()) {
  if (t.status === 'Cancelled') return '—';
  const created = ms(t.created_at);
  const due = created + (slaMinutes[t.priority] ?? DEFAULT_SLA_MINUTES[t.priority] ?? 0) * 60000;
  const resolved = ms(t.resolved_at);
  if (resolved) return resolved <= due ? 'SLA Met' : 'SLA Breached';
  if (now > due) return 'SLA Breached';
  return (now - created) / (due - created) > 0.75 ? 'At Risk' : 'Within SLA';
}

export const SLA_TONE = {
  'SLA Breached': 'red',
  'At Risk': 'amber',
  'SLA Met': 'green',
  'Within SLA': 'slate',
  '—': 'slate',
};

export function formatDuration(minutes) {
  if (minutes == null || Number.isNaN(minutes)) return '—';
  const h = minutes / 60;
  if (h < 1) return `${Math.round(minutes)} min`;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} days`;
}

/** Time since creation, stopping at resolution/closure. */
export function taskAge(t, now = Date.now()) {
  const end = ms(t.resolved_at) || ms(t.closed_at) || now;
  return formatDuration(Math.max(0, (end - ms(t.created_at)) / 60000));
}
