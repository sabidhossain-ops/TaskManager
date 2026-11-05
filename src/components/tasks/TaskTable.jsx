import { PriorityBadge, StatusBadge } from '../ui/Badge';
import { EditIcon, EyeIcon, TrashIcon } from '../ui/Icons';
import { formatDate } from '../../utils/format';

function RowActions({ task, onView, onEdit, onDelete }) {
  const btn = 'rounded-lg p-2 text-slate-500 transition-colors';
  return (
    <div className="flex items-center justify-end gap-1">
      <button onClick={() => onView(task)} className={`${btn} hover:bg-slate-100 hover:text-slate-800`} aria-label={`View ${task.title}`} title="View">
        <EyeIcon className="h-4 w-4" />
      </button>
      <button onClick={() => onEdit(task)} className={`${btn} hover:bg-blue-50 hover:text-blue-700`} aria-label={`Edit ${task.title}`} title="Edit">
        <EditIcon className="h-4 w-4" />
      </button>
      <button onClick={() => onDelete(task)} className={`${btn} hover:bg-red-50 hover:text-red-600`} aria-label={`Delete ${task.title}`} title="Delete">
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function SkeletonRows({ rows = 5 }) {
  return Array.from({ length: rows }, (_, i) => (
    <tr key={i} className="border-b border-slate-100">
      {Array.from({ length: 6 }, (_, j) => (
        <td key={j} className="px-4 py-4">
          <div className="h-4 animate-pulse rounded bg-slate-200" style={{ width: j === 0 ? '80%' : '60%' }} />
        </td>
      ))}
    </tr>
  ));
}

export default function TaskTable({ tasks, loading, ...actions }) {
  return (
    <>
      {/* Desktop / tablet: data table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-y border-slate-200 bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <tr>
              <th scope="col" className="px-4 py-3">Task</th>
              <th scope="col" className="px-4 py-3">Priority</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Assigned to</th>
              <th scope="col" className="px-4 py-3">Updated</th>
              <th scope="col" className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <SkeletonRows />
            ) : (
              tasks.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/70">
                  <td className="max-w-sm px-4 py-3">
                    <button onClick={() => actions.onView(t)} className="block max-w-full truncate text-left font-medium text-slate-900 hover:text-brand-600">
                      {t.title}
                    </button>
                    {t.description && <p className="truncate text-xs text-slate-500">{t.description}</p>}
                  </td>
                  <td className="px-4 py-3"><PriorityBadge value={t.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge value={t.status} /></td>
                  <td className="px-4 py-3 text-slate-600">{t.assigned_to || <span className="text-slate-400">Unassigned</span>}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatDate(t.updated_at || t.created_at)}</td>
                  <td className="px-4 py-2"><RowActions task={t} {...actions} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <ul className="divide-y divide-slate-100 border-t border-slate-200 md:hidden">
        {loading
          ? Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="space-y-2 p-4">
                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200" />
              </li>
            ))
          : tasks.map((t) => (
              <li key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => actions.onView(t)} className="text-left font-medium text-slate-900">
                    {t.title}
                  </button>
                  <RowActions task={t} {...actions} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <StatusBadge value={t.status} />
                  <PriorityBadge value={t.priority} />
                  <span>· {t.assigned_to || 'Unassigned'}</span>
                </div>
              </li>
            ))}
      </ul>
    </>
  );
}
