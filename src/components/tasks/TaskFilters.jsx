import { TASK_PRIORITIES, TASK_STATUSES } from '../../constants/task';
import { SearchIcon, XIcon } from '../ui/Icons';

export default function TaskFilters({ search, status, priority, onChange, onReset }) {
  const hasFilters = search || status || priority;
  const select = 'input sm:w-44';

  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder="Search title, description or assignee…"
          className="input pl-9"
          aria-label="Search tasks"
          maxLength={100}
        />
      </div>
      <select value={status} onChange={(e) => onChange({ status: e.target.value })} className={select} aria-label="Filter by status">
        <option value="">All statuses</option>
        {TASK_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
      <select value={priority} onChange={(e) => onChange({ priority: e.target.value })} className={select} aria-label="Filter by priority">
        <option value="">All priorities</option>
        {TASK_PRIORITIES.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
      {hasFilters && (
        <button onClick={onReset} className="inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
          <XIcon className="h-4 w-4" /> Clear
        </button>
      )}
    </div>
  );
}
