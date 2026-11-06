import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as taskService from '../services/taskService';
import { useAuth } from '../context/AuthContext';
import { useRefData } from '../context/RefDataContext';
import { useTaskUI } from '../context/TaskUIContext';
import { useToast } from '../context/ToastContext';
import { useDebounce } from '../hooks/useDebounce';
import { DEFAULT_PAGE_SIZE, EXPORT_LIMIT } from '../constants/task';
import TaskFilters from '../components/tasks/TaskFilters';
import TaskTable from '../components/tasks/TaskTable';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import { AlertIcon, PlusIcon } from '../components/ui/Icons';
import { formatDateTime } from '../utils/format';
import { slaState, taskAge } from '../utils/sla';
import { downloadCsv, toCsv } from '../utils/csv';

const INITIAL = { search: '', status: '', priority: '', overdueOnly: false };

/** scope = 'all' (everything the role can see) | 'mine' (assigned to me) */
export default function TasksPage({ scope }) {
  const { profile, canCreate } = useAuth();
  const { sla } = useRefData();
  const { openTask, openCreate, version } = useTaskUI();
  const toast = useToast();

  const [filters, setFilters] = useState(INITIAL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [data, setData] = useState({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [mineMode, setMineMode] = useState('assigned'); // My tasks: 'assigned' | 'created'
  const [params, setParams] = useSearchParams();

  // Links in assignment emails: /my-tasks?task=<id> opens that task
  useEffect(() => {
    const id = Number(params.get('task'));
    if (id) {
      openTask(id);
      setParams({}, { replace: true });
    }
  }, [params, setParams, openTask]);

  const search = useDebounce(filters.search);
  const requestId = useRef(0);
  const query = { search, status: filters.status, priority: filters.priority, overdueOnly: filters.overdueOnly, assignedTo: scope === 'mine' && mineMode === 'assigned' ? profile.id : null, createdBy: scope === 'mine' && mineMode === 'created' ? profile.id : null };
  const queryKey = JSON.stringify(query);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const result = await taskService.listTasks({ page, pageSize, ...JSON.parse(queryKey) });
      if (id !== requestId.current) return;
      if (!result.rows.length && page > 1) return setPage((p) => p - 1);
      setData(result);
    } catch (err) {
      if (id === requestId.current) setError(err.message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [page, pageSize, queryKey]);

  useEffect(() => {
    load();
  }, [load, version]);

  const update = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  async function handleExport() {
    setExporting(true);
    try {
      const rows = await taskService.exportTasks(query);
      const csv = toCsv(
        ['Task ID', 'Title', 'Type', 'Priority', 'Center', 'Department', 'Source', 'Raised by', 'Assigned to', 'Created', 'Deadline', 'Status', 'Aging', 'SLA'],
        rows.map((t) => [
          t.task_no, t.title, t.task_type, t.priority, t.center, t.department, t.source, t.raised_by,
          t.assignee?.full_name ?? 'Unassigned', formatDateTime(t.created_at), formatDateTime(t.deadline),
          t.status, taskAge(t), slaState(t, sla),
        ]),
      );
      downloadCsv(`BHL_tasks_${new Date().toISOString().slice(0, 10)}.csv`, csv);
      toast.success(rows.length >= EXPORT_LIMIT ? `Exported the first ${EXPORT_LIMIT} tasks.` : `Exported ${rows.length} tasks.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  }

  const hasFilters = filters.search || filters.status || filters.priority || filters.overdueOnly;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          {scope === 'mine' ? (mineMode === 'assigned' ? 'Tasks assigned to you.' : 'Tasks you created.') : 'Every task you have access to. Critical tasks are highlighted.'}
        </p>
        {scope === 'mine' && (
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm" role="group" aria-label="Which tasks">
            {[['assigned', 'Assigned to me'], ['created', 'Created by me']].map(([k, label]) => (
              <button
                key={k}
                onClick={() => { setMineMode(k); setPage(1); }}
                aria-pressed={mineMode === k}
                className={`rounded-md px-3 py-1.5 font-medium ${mineMode === k ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {canCreate && (
          <Button onClick={openCreate}><PlusIcon className="h-4 w-4" /> Create task</Button>
        )}
      </div>

      <section className="card overflow-hidden">
        <TaskFilters filters={filters} onChange={update} onReset={() => update(INITIAL)} onExport={handleExport} exporting={exporting} />

        {error && !loading ? (
          <EmptyState icon={AlertIcon} title="Could not load tasks" message={error} action={<Button variant="secondary" onClick={load}>Try again</Button>} />
        ) : !loading && data.rows.length === 0 ? (
          <EmptyState
            title={hasFilters ? 'No tasks match these filters' : scope === 'mine' ? (mineMode === 'assigned' ? 'Nothing assigned to you' : 'You have not created any tasks') : 'No tasks yet'}
            message={hasFilters ? 'Try a different search or clear the filters.' : canCreate ? 'Create the first task to start tracking work.' : 'Tasks will appear here when they are assigned to you.'}
            action={
              hasFilters ? <Button variant="secondary" onClick={() => update(INITIAL)}>Clear filters</Button>
                : canCreate ? <Button onClick={openCreate}><PlusIcon className="h-4 w-4" /> Create task</Button> : null
            }
          />
        ) : (
          <>
            <TaskTable tasks={data.rows} loading={loading && data.rows.length === 0} sla={sla} onOpen={openTask} />
            <Pagination
              page={page}
              pageSize={pageSize}
              total={data.total}
              onPageChange={setPage}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
              }}
            />
          </>
        )}
      </section>
    </div>
  );
}
