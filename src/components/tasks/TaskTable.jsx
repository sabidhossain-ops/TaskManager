import { PriorityBadge, SlaBadge, StatusBadge } from '../ui/Badge';
import { formatDateTime } from '../../utils/format';
import { isOverdue, slaState, taskAge } from '../../utils/sla';

const HEADERS = ['Task ID', 'Title', 'Priority', 'Center', 'Assigned to', 'Deadline', 'Status', 'Aging', 'SLA'];

function SkeletonRows() {
  return Array.from({ length: 6 }, (_, i) => (
    <tr key={i}>
      {HEADERS.map((h) => (
        <td key={h} className="px-3 py-3.5"><div className="h-4 animate-pulse rounded bg-slate-200" /></td>
      ))}
    </tr>
  ));
}

export default function TaskTable({ tasks, loading, sla, onOpen }) {
  const now = Date.now();
  const keyOpen = (t) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen(t.id);
    }
  };

  return (
    <>
      {/* Desktop: data table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-y border-slate-200 bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <tr>{HEADERS.map((h) => <th key={h} scope="col" className="px-3 py-3 whitespace-nowrap">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <SkeletonRows />
            ) : (
              tasks.map((t) => {
                const critical = t.priority === 'Critical';
                const overdue = isOverdue(t, now);
                return (
                  <tr
                    key={t.id}
                    tabIndex={0}
                    onClick={() => onOpen(t.id)}
                    onKeyDown={keyOpen(t)}
                    className={`cursor-pointer ${critical ? 'bg-red-50/70 shadow-[inset_4px_0_0_#dc2626] hover:bg-red-50' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-3 py-3 font-mono text-xs whitespace-nowrap text-slate-600">{t.task_no}</td>
                    <td className="max-w-xs px-3 py-3 font-medium text-slate-900"><span className="line-clamp-2">{t.title}</span></td>
                    <td className="px-3 py-3"><PriorityBadge value={t.priority} /></td>
                    <td className="px-3 py-3 whitespace-nowrap text-slate-600">{t.center}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-slate-600">{t.assignee?.full_name ?? <span className="text-slate-400">Unassigned</span>}</td>
                    <td className={`px-3 py-3 whitespace-nowrap ${overdue ? 'font-medium text-red-600' : 'text-slate-600'}`}>{formatDateTime(t.deadline)}</td>
                    <td className="px-3 py-3"><StatusBadge value={t.status} /></td>
                    <td className="px-3 py-3 whitespace-nowrap text-slate-600">{taskAge(t, now)}</td>
                    <td className="px-3 py-3"><SlaBadge value={slaState(t, sla, now)} /></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <ul className="divide-y divide-slate-100 border-t border-slate-200 md:hidden">
        {loading
          ? Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="space-y-2 p-4">
                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200" />
              </li>
            ))
          : tasks.map((t) => (
              <li key={t.id} className={t.priority === 'Critical' ? 'bg-red-50/70 shadow-[inset_4px_0_0_#dc2626]' : ''}>
                <button onClick={() => onOpen(t.id)} className="w-full p-4 text-left">
                  <p className="font-mono text-xs text-slate-500">{t.task_no}</p>
                  <p className="mt-0.5 font-medium text-slate-900">{t.title}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <StatusBadge value={t.status} />
                    <PriorityBadge value={t.priority} />
                    <SlaBadge value={slaState(t, sla, now)} />
                  </div>
                  <p className={`mt-2 text-xs ${isOverdue(t, now) ? 'text-red-600' : 'text-slate-500'}`}>
                    {t.assignee?.full_name ?? 'Unassigned'} · due {formatDateTime(t.deadline)} · {taskAge(t, now)}
                  </p>
                </button>
              </li>
            ))}
      </ul>
    </>
  );
}
