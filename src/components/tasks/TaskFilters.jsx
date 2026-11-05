import { PRIORITIES, STATUSES } from '../../constants/task';
import { DownloadIcon, SearchIcon, XIcon } from '../ui/Icons';
import Button from '../ui/Button';

export default function TaskFilters({ filters, onChange, onReset, onExport, exporting }) {
  const { search, status, priority, overdueOnly } = filters;
  const hasFilters = search || status || priority || overdueOnly;

  return (
    <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder="Search task ID or title…"
          className="input pl-9"
          aria-label="Search tasks"
          maxLength={100}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <select value={status} onChange={(e) => onChange({ status: e.target.value })} className="input w-auto" aria-label="Filter by status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={priority} onChange={(e) => onChange({ priority: e.target.value })} className="input w-auto" aria-label="Filter by priority">
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={overdueOnly} onChange={(e) => onChange({ overdueOnly: e.target.checked })} className="h-4 w-4 accent-brand-500" />
          Overdue only
        </label>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onReset}><XIcon className="h-4 w-4" /> Clear filters</Button>
        )}
        {onExport && (
          <Button variant="secondary" size="sm" onClick={onExport} loading={exporting}><DownloadIcon className="h-4 w-4" /> Export CSV</Button>
        )}
      </div>
    </div>
  );
}
